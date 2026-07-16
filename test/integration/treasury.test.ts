import { strict as assert } from "node:assert";
import { before, describe, it } from "node:test";
import { parseEther, type Hex } from "viem";
import { nox } from "@iexec-nox/nox-hardhat-plugin";
import { waitForHandleResolved } from "../utils/handle-gateway.js";

/**
 * The on-chain treasury: an auditable house bankroll escrowed in the contract.
 * Deposit once, open many small rounds from it, expired pots flow back.
 * Invariant under test throughout: contract balance == treasury + Σ open pots.
 */

const LONG = { timeout: 600_000 };

const DEPOSIT = parseEther("0.5");
const POT = parseEther("0.01");
const GRACE = 15n * 60n;

const l = (word: string) =>
  [...word].map((c) => c.charCodeAt(0) - 97) as [number, number, number, number, number];

describe("CryptoWordle treasury", () => {
  let viem: Awaited<ReturnType<typeof nox.connect>>["viem"];
  let publicClient: any;
  let treasurer: any; // walletClients[0] — deploys, so it is the treasurer
  let player: any;
  let game: any;
  let gameAsPlayer: any;

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

  const contractBalance = async () => publicClient.getBalance({ address: game.address });
  const treasuryValue = async () => (await game.read.treasury()) as bigint;

  before(async () => {
    const connection = await nox.connect();
    viem = connection.viem;
    publicClient = await viem.getPublicClient();
    [treasurer, player] = await viem.getWalletClients();
    game = await viem.deployContract("CryptoWordle", []);
    gameAsPlayer = await viem.getContractAt("CryptoWordle", game.address, {
      client: { wallet: player },
    });
  }, LONG);

  it("accepts deposits via fundTreasury and plain transfers", LONG, async () => {
    let tx = await game.write.fundTreasury({ value: DEPOSIT });
    await publicClient.waitForTransactionReceipt({ hash: tx });
    assert.equal(await treasuryValue(), DEPOSIT);

    // A naked send must credit the treasury too (receive()).
    tx = await treasurer.sendTransaction({ to: game.address, value: POT });
    await publicClient.waitForTransactionReceipt({ hash: tx });
    assert.equal(await treasuryValue(), DEPOSIT + POT);
    assert.equal(await contractBalance(), DEPOSIT + POT);
  });

  it("only the treasurer can open treasury rounds or withdraw", LONG, async () => {
    const { handles, proofs } = await encryptWord("abbey");
    await assert.rejects(
      gameAsPlayer.write.createRoundFromTreasury([handles, proofs, 3600n, POT]),
      /NotTreasurer|reverted/,
    );
    await assert.rejects(
      gameAsPlayer.write.withdrawTreasury([POT]),
      /NotTreasurer|reverted/,
    );
  });

  it("opens rounds from the treasury and keeps the balance invariant", LONG, async () => {
    const treasuryBefore = await treasuryValue();
    const { handles, proofs } = await encryptWord("abbey");
    const tx = await game.write.createRoundFromTreasury([handles, proofs, 3600n, POT]);
    await publicClient.waitForTransactionReceipt({ hash: tx });

    assert.equal(await treasuryValue(), treasuryBefore - POT, "pot debited from treasury");
    const [, pot, , status] = (await game.read.getRound([0n])) as any[];
    assert.equal(pot, POT);
    assert.equal(status, 0); // Open
    // Escrow invariant: nothing left or entered the contract.
    assert.equal(await contractBalance(), treasuryBefore, "balance == treasury + open pot");

    await assert.rejects(
      game.write.createRoundFromTreasury([handles, proofs, 3600n, parseEther("100")]),
      /InsufficientTreasury|reverted/,
    );
  });

  it("pays a treasury-round winner exactly like a funded round", LONG, async () => {
    const tx = await gameAsPlayer.write.guess([0n, l("abbey")]);
    await publicClient.waitForTransactionReceipt({ hash: tx });

    const g = (await game.read.getGuess([0n, 0n])) as any;
    await waitForHandleResolved(g.winHandle, { timeoutMs: 300_000 });
    const { value: won, decryptionProof } = await nox.publicDecrypt(g.winHandle);
    assert.equal(won, true);

    const balanceBefore = await publicClient.getBalance({ address: player.account.address });
    const treasuryBefore = await treasuryValue();
    const claimTx = await game.write.claim([0n, 0n, decryptionProof]);
    await publicClient.waitForTransactionReceipt({ hash: claimTx });

    const balanceAfter = await publicClient.getBalance({ address: player.account.address });
    assert.equal(balanceAfter - balanceBefore, POT, "winner receives the treasury pot");
    assert.equal(await treasuryValue(), treasuryBefore, "claim never touches the treasury");
    assert.equal(await contractBalance(), treasuryBefore, "escrow invariant after payout");
  });

  it("refunds an expired treasury round INTO the treasury, not the creator", LONG, async () => {
    const { handles, proofs } = await encryptWord("gnome");
    let tx = await game.write.createRoundFromTreasury([handles, proofs, 600n, POT]);
    await publicClient.waitForTransactionReceipt({ hash: tx });
    const treasuryAfterOpen = await treasuryValue();

    await publicClient.request({
      method: "evm_increaseTime",
      params: [Number(600n + GRACE + 10n)],
    });
    await publicClient.request({ method: "evm_mine", params: [] });

    const treasurerBefore = await publicClient.getBalance({
      address: treasurer.account.address,
    });
    // The PLAYER cranks the expiry — proving the refund does not chase the caller.
    tx = await gameAsPlayer.write.revealExpired([1n]);
    await publicClient.waitForTransactionReceipt({ hash: tx });

    assert.equal(
      await treasuryValue(),
      treasuryAfterOpen + POT,
      "expired pot returns to the bankroll",
    );
    const treasurerAfter = await publicClient.getBalance({
      address: treasurer.account.address,
    });
    assert.equal(treasurerAfter, treasurerBefore, "no ETH left the contract on expiry");
  });

  it("lets the treasurer withdraw only the uncommitted bankroll", LONG, async () => {
    const treasuryNow = await treasuryValue();
    await assert.rejects(
      game.write.withdrawTreasury([treasuryNow + 1n]),
      /InsufficientTreasury|reverted/,
    );

    const tx = await game.write.withdrawTreasury([treasuryNow]);
    await publicClient.waitForTransactionReceipt({ hash: tx });
    assert.equal(await treasuryValue(), 0n);
    assert.equal(await contractBalance(), 0n, "no open pots → contract fully drained");
  });
});
