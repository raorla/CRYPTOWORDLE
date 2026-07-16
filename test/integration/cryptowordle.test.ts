import { strict as assert } from "node:assert";
import { before, describe, it } from "node:test";
import { parseEther, type Hex } from "viem";
import { nox, NOX_COMPUTE_ADDRESS } from "@iexec-nox/nox-hardhat-plugin";
import { waitForHandleResolved } from "../utils/handle-gateway.js";

/**
 * End-to-end tests against the REAL local Nox stack (Docker: KMS, handle
 * gateway, runner) — encrypted inputs, on-ciphertext color computation,
 * genuine KMS decryption proofs verified on-chain. No mocks anywhere.
 *
 * The runner executes ops sequentially, and a single guess emits ~95 TEE ops,
 * so timeouts are generous and decrypt-heavy tests run before decrypt-free
 * ones to keep the runner queue short where it matters.
 */

const LONG = { timeout: 600_000 };

// "abbey" — chosen for its duplicate letter to pin down the color logic.
const SECRET = "abbey";
// "kebab" vs "abbey": k absent, e present, b green (pos 2), a present, b present.
const PROBE = "kebab";
const PROBE_COLORS = [0n, 1n, 2n, 1n, 1n];

const POT = parseEther("0.5");
const DURATION = 3600n; // 1 hour
const GRACE = 15n * 60n; // must match CLAIM_GRACE_PERIOD

const l = (word: string) =>
  [...word].map((c) => c.charCodeAt(0) - 97) as [number, number, number, number, number];

const ACL_VIEWS_ABI = [
  {
    type: "function",
    name: "isPubliclyDecryptable",
    stateMutability: "view",
    inputs: [{ name: "handle", type: "bytes32" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "isAllowed",
    stateMutability: "view",
    inputs: [
      { name: "handle", type: "bytes32" },
      { name: "account", type: "address" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "isViewer",
    stateMutability: "view",
    inputs: [
      { name: "handle", type: "bytes32" },
      { name: "viewer", type: "address" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

describe("CryptoWordle on the local Nox coprocessor", () => {
  // Shared across sequential tests: one deployed game, one main round.
  let viem: Awaited<ReturnType<typeof nox.connect>>["viem"];
  let publicClient: any;
  let creator: any; // walletClients[0] — encrypts the secret, creates rounds
  let player: any; // walletClients[1] — guesses
  let cranker: any; // walletClients[2] — proves claims (permissionless crank)
  let game: any; // creator-bound contract instance
  let gameAsPlayer: any;
  let gameAsCranker: any;
  let roundId = 0n;
  let winningGuessIndex = 0n;
  let probeWinHandle: Hex; // the LOSING guess's win handle (for false-proof test)

  const encryptWord = async (word: string) => {
    const handles: Hex[] = [];
    const proofs: Hex[] = [];
    for (const letter of l(word)) {
      const enc = await nox.encryptInput(BigInt(letter), "uint256", game.address);
      handles.push(enc.handle);
      proofs.push(enc.handleProof);
    }
    return { handles, proofs };
  };

  const createRound = async (word: string, duration = DURATION) => {
    const { handles, proofs } = await encryptWord(word);
    const tx = await game.write.createRound([handles, proofs, duration], { value: POT });
    await publicClient.waitForTransactionReceipt({ hash: tx });
    return (await game.read.latestRoundId()) as bigint;
  };

  const decryptColors = async (colorHandles: readonly Hex[]) => {
    const colors: bigint[] = [];
    for (const h of colorHandles) {
      await waitForHandleResolved(h, { timeoutMs: 300_000 });
      const { value } = await nox.publicDecrypt(h);
      colors.push(value as bigint);
    }
    return colors;
  };

  before(async () => {
    const connection = await nox.connect();
    viem = connection.viem;
    publicClient = await viem.getPublicClient();
    const wallets = await viem.getWalletClients();
    [creator, player, cranker] = wallets;

    game = await viem.deployContract("CryptoWordle", []);
    gameAsPlayer = await viem.getContractAt("CryptoWordle", game.address, {
      client: { wallet: player },
    });
    gameAsCranker = await viem.getContractAt("CryptoWordle", game.address, {
      client: { wallet: cranker },
    });

    roundId = await createRound(SECRET);
  }, LONG);

  it("creates a round holding only encrypted letters and the pot", LONG, async () => {
    const [creatorAddr, pot, , status, , guessCount] = (await game.read.getRound([
      roundId,
    ])) as any[];
    assert.equal(creatorAddr.toLowerCase(), creator.account.address.toLowerCase());
    assert.equal(pot, POT);
    assert.equal(status, 0); // Open
    assert.equal(guessCount, 0);
    assert.equal(await publicClient.getBalance({ address: game.address }), POT);
  });

  it("keeps the secret mathematically un-leakable while the round is Open", LONG, async () => {
    const secretHandles = (await game.read.getSecretHandles([roundId])) as Hex[];
    for (const handle of secretHandles) {
      const [isPublic, playerAllowed, playerViewer, crankerAllowed] = await Promise.all([
        publicClient.readContract({
          address: NOX_COMPUTE_ADDRESS,
          abi: ACL_VIEWS_ABI,
          functionName: "isPubliclyDecryptable",
          args: [handle],
        }),
        publicClient.readContract({
          address: NOX_COMPUTE_ADDRESS,
          abi: ACL_VIEWS_ABI,
          functionName: "isAllowed",
          args: [handle, player.account.address],
        }),
        publicClient.readContract({
          address: NOX_COMPUTE_ADDRESS,
          abi: ACL_VIEWS_ABI,
          functionName: "isViewer",
          args: [handle, player.account.address],
        }),
        publicClient.readContract({
          address: NOX_COMPUTE_ADDRESS,
          abi: ACL_VIEWS_ABI,
          functionName: "isAllowed",
          args: [handle, cranker.account.address],
        }),
      ]);
      assert.equal(isPublic, false, "secret letter must not be publicly decryptable");
      assert.equal(playerAllowed, false, "no player may be admin of a secret letter");
      assert.equal(playerViewer, false, "no player may be viewer of a secret letter");
      assert.equal(crankerAllowed, false, "no third party may be admin of a secret letter");
      // The contract itself is the only allowed principal.
      const contractAllowed = await publicClient.readContract({
        address: NOX_COMPUTE_ADDRESS,
        abi: ACL_VIEWS_ABI,
        functionName: "isAllowed",
        args: [handle, game.address],
      });
      assert.equal(contractAllowed, true, "the contract keeps access via allowThis");
    }
  });

  it("computes Wordle colors on ciphertext — only colors come out", LONG, async () => {
    const tx = await gameAsPlayer.write.guess([roundId, l(PROBE)]);
    await publicClient.waitForTransactionReceipt({ hash: tx });

    const g = (await game.read.getGuess([roundId, 0n])) as any;
    assert.equal(g.player.toLowerCase(), player.account.address.toLowerCase());
    probeWinHandle = g.winHandle;

    const colors = await decryptColors(g.colorHandles);
    assert.deepEqual(colors, PROBE_COLORS, `colors of "${PROBE}" vs "${SECRET}"`);

    await waitForHandleResolved(g.winHandle, { timeoutMs: 300_000 });
    const { value: won } = await nox.publicDecrypt(g.winHandle);
    assert.equal(won, false, "a wrong word must not set the win flag");

    // The secret stays sealed even though hints came out.
    const secretHandles = (await game.read.getSecretHandles([roundId])) as Hex[];
    for (const handle of secretHandles) {
      const isPublic = await publicClient.readContract({
        address: NOX_COMPUTE_ADDRESS,
        abi: ACL_VIEWS_ABI,
        functionName: "isPubliclyDecryptable",
        args: [handle],
      });
      assert.equal(isPublic, false);
    }
  });

  it("rejects malformed guesses without touching the TEE", LONG, async () => {
    await assert.rejects(
      gameAsPlayer.write.guess([roundId, [0, 1, 2, 3, 26]]),
      /LetterOutOfRange|reverted/,
    );
    await assert.rejects(
      gameAsPlayer.write.guess([999n, l(PROBE)]),
      /RoundDoesNotExist|reverted/,
    );
  });

  it("detects the winning guess and pays the pot trustlessly via KMS proof", LONG, async () => {
    const tx = await gameAsPlayer.write.guess([roundId, l(SECRET)]);
    await publicClient.waitForTransactionReceipt({ hash: tx });
    winningGuessIndex = 1n;

    const g = (await game.read.getGuess([roundId, winningGuessIndex])) as any;

    const colors = await decryptColors(g.colorHandles);
    assert.deepEqual(colors, [2n, 2n, 2n, 2n, 2n], "correct word must be all green");

    await waitForHandleResolved(g.winHandle, { timeoutMs: 300_000 });
    const { value: won, decryptionProof } = await nox.publicDecrypt(g.winHandle);
    assert.equal(won, true);

    // A third party cranks the claim — the pot must still go to the player.
    const balanceBefore = await publicClient.getBalance({
      address: player.account.address,
    });
    const claimTx = await gameAsCranker.write.claim([
      roundId,
      winningGuessIndex,
      decryptionProof,
    ]);
    await publicClient.waitForTransactionReceipt({ hash: claimTx });

    const balanceAfter = await publicClient.getBalance({
      address: player.account.address,
    });
    assert.equal(balanceAfter - balanceBefore, POT, "pot goes to the guesser, not the cranker");

    const [, pot, , status, winner] = (await game.read.getRound([roundId])) as any[];
    assert.equal(status, 1); // Solved
    assert.equal(winner.toLowerCase(), player.account.address.toLowerCase());
    assert.equal(pot, 0n);
  });

  it("reveals the secret after the win so anyone can audit the hints", LONG, async () => {
    const [, , , , , , revealedHandles] = (await game.read.getRound([roundId])) as any[];
    const letters: bigint[] = [];
    for (const h of revealedHandles as Hex[]) {
      await waitForHandleResolved(h, { timeoutMs: 300_000 });
      const { value } = await nox.publicDecrypt(h);
      letters.push(value as bigint);
    }
    assert.deepEqual(
      letters,
      l(SECRET).map(BigInt),
      "revealed letters must spell the secret word",
    );
  });

  it("refuses claim replays and post-solve guesses", LONG, async () => {
    const { decryptionProof } = await nox.publicDecrypt(
      ((await game.read.getGuess([roundId, winningGuessIndex])) as any).winHandle,
    );
    await assert.rejects(
      gameAsCranker.write.claim([roundId, winningGuessIndex, decryptionProof]),
      /RoundNotOpen|reverted/,
      "second claim must revert — one payout only",
    );
    await assert.rejects(
      gameAsPlayer.write.guess([roundId, l(PROBE)]),
      /RoundNotOpen|reverted/,
    );
  });

  it("rejects claims backed by a losing guess or a forged proof", LONG, async () => {
    // Fresh round so status checks don't mask the proof checks.
    const newRound = await createRound(SECRET);

    const tx = await gameAsPlayer.write.guess([newRound, l(PROBE)]);
    await publicClient.waitForTransactionReceipt({ hash: tx });

    const g = (await game.read.getGuess([newRound, 0n])) as any;
    await waitForHandleResolved(g.winHandle, { timeoutMs: 300_000 });
    const { value: won, decryptionProof } = await nox.publicDecrypt(g.winHandle);
    assert.equal(won, false);

    // Genuine proof of a FALSE win value → NotAWinningGuess.
    await assert.rejects(
      gameAsCranker.write.claim([newRound, 0n, decryptionProof]),
      /NotAWinningGuess|reverted/,
    );

    // Forged proof → the NoxCompute signature check must revert.
    await assert.rejects(
      gameAsCranker.write.claim([newRound, 0n, `0x${"42".repeat(97)}`]),
      /reverted|Invalid/,
    );

    // Proof for the OLD round's probe guess used on this round's guess index —
    // the proof is bound to its handle, so it must not validate here.
    if (probeWinHandle) {
      const old = await nox.publicDecrypt(probeWinHandle);
      await assert.rejects(
        gameAsCranker.write.claim([newRound, 0n, old.decryptionProof]),
        /reverted|Invalid|NotAWinningGuess/,
      );
    }
  });

  it("expires unsolved rounds: secret revealed, pot refunded to creator", LONG, async () => {
    const expiringRound = await createRound(SECRET, 600n); // 10 min round

    // A player takes some (losing) shots — never decrypted, so no runner wait.
    const tx = await gameAsPlayer.write.guess([expiringRound, l(PROBE)]);
    await publicClient.waitForTransactionReceipt({ hash: tx });

    // Too early: before deadline + grace.
    await assert.rejects(
      gameAsCranker.write.revealExpired([expiringRound]),
      /RoundNotExpired|reverted/,
    );

    // Warp past deadline + grace on the local node.
    await publicClient.request({
      method: "evm_increaseTime",
      params: [Number(600n + GRACE + 10n)],
    });
    await publicClient.request({ method: "evm_mine", params: [] });

    // Past the deadline, guessing is over…
    await assert.rejects(
      gameAsPlayer.write.guess([expiringRound, l(PROBE)]),
      /DeadlinePassed|reverted/,
    );

    // …and anyone can expire the round.
    const creatorBefore = await publicClient.getBalance({
      address: creator.account.address,
    });
    const expireTx = await gameAsCranker.write.revealExpired([expiringRound]);
    await publicClient.waitForTransactionReceipt({ hash: expireTx });

    const creatorAfter = await publicClient.getBalance({
      address: creator.account.address,
    });
    assert.equal(creatorAfter - creatorBefore, POT, "pot refunds to the round creator");

    const [, , , status, , , revealedHandles] = (await game.read.getRound([
      expiringRound,
    ])) as any[];
    assert.equal(status, 2); // Expired

    const letters: bigint[] = [];
    for (const h of revealedHandles as Hex[]) {
      await waitForHandleResolved(h, { timeoutMs: 300_000 });
      const { value } = await nox.publicDecrypt(h);
      letters.push(value as bigint);
    }
    assert.deepEqual(letters, l(SECRET).map(BigInt));

    // Replay of the expiry crank must fail.
    await assert.rejects(
      gameAsCranker.write.revealExpired([expiringRound]),
      /RoundNotOpen|reverted/,
    );
  });

  it("enforces the six-guess limit per player", LONG, async () => {
    const limitRound = await createRound(SECRET);
    // 5 more losing guesses on top of… none yet in this round: submit 6.
    const words = ["which", "there", "their", "about", "would", "these"];
    for (const w of words) {
      const tx = await gameAsPlayer.write.guess([limitRound, l(w)]);
      await publicClient.waitForTransactionReceipt({ hash: tx });
    }
    await assert.rejects(
      gameAsPlayer.write.guess([limitRound, l(PROBE)]),
      /GuessLimitReached|reverted/,
      "7th guess by the same player must revert",
    );
    // …but another player still has their own six.
    const asCreator = await game.write.guess([limitRound, l(PROBE)]);
    await publicClient.waitForTransactionReceipt({ hash: asCreator });
  });
});
