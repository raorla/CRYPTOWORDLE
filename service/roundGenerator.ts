import { randomInt } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { parseEther, type Hex } from "viem";
import { ANSWERS } from "../shared/words.ts";
import {
  GAS,
  encryptWord,
  loadArtifact,
  loadDeployment,
  makeClient,
  makeHandleClient,
} from "./common.ts";

/**
 * The round generator — the only process that ever sees a round's plaintext
 * word, and only for the milliseconds between random pick and encryption.
 *
 * Privacy contract of this file (the "provably un-leakable" story):
 *   - the word is chosen with CSPRNG randomness (node:crypto.randomInt);
 *   - it is NEVER logged, NEVER written to disk, NEVER sent anywhere except
 *     to the Nox handle gateway over attested TLS as encryptInput plaintext;
 *   - the local variable goes out of scope right after encryption. Gone.
 *
 * Modes:
 *   node service/roundGenerator.ts --once   # create one round if none open
 *   node service/roundGenerator.ts          # daemon: keep a round always open,
 *                                           # expire stale rounds, crank claims
 */

const POLL_MS = 30_000;
const POT_ETH = process.env.ROUND_POT_ETH ?? "0.01";
const DURATION = BigInt(process.env.ROUND_DURATION_SECONDS ?? "86400");
const CLAIM_GRACE = 15n * 60n; // matches CryptoWordle.CLAIM_GRACE_PERIOD

const client = makeClient();
const handleClient = await makeHandleClient(client);
const { abi } = loadArtifact();
const deployment = loadDeployment();
const contract = { address: deployment.address, abi } as const;

console.log(`Round generator for CryptoWordle @ ${deployment.address}`);
console.log(`Wallet: ${client.account!.address}, pot: ${POT_ETH} ETH, duration: ${DURATION}s`);

type RoundInfo = {
  creator: Hex;
  pot: bigint;
  deadline: bigint;
  status: number; // 0 Open, 1 Solved, 2 Expired
  winner: Hex;
  guessCount: number;
};

async function readRound(roundId: bigint): Promise<RoundInfo> {
  const [creator, pot, deadline, status, winner, guessCount] =
    (await client.readContract({
      ...contract,
      functionName: "getRound",
      args: [roundId],
    })) as any[];
  return { creator, pot, deadline: BigInt(deadline), status, winner, guessCount };
}

async function latestRoundId(): Promise<bigint | null> {
  const count = (await client.readContract({
    ...contract,
    functionName: "roundCount",
  })) as bigint;
  return count === 0n ? null : count - 1n;
}

async function createRound(): Promise<void> {
  console.log("Creating a new round…");
  // The secret exists in plaintext ONLY inside this block.
  {
    const word = ANSWERS[randomInt(ANSWERS.length)];
    const { handles, proofs } = await encryptWord(handleClient, word, deployment.address);
    console.log("  word sealed 🔒 (5 encrypted handles ready — plaintext discarded)");

    const hash = await client.writeContract({
      ...contract,
      functionName: "createRound",
      args: [handles, proofs, DURATION],
      value: parseEther(POT_ETH),
      gas: GAS.createRound,
      account: client.account!,
      chain: client.chain,
    });
    console.log(`  tx: ${hash}`);
    const receipt = await client.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error("createRound tx reverted");
  }
  const roundId = await latestRoundId();
  console.log(`  round #${roundId} is live ✔ (pot ${POT_ETH} ETH, ${DURATION}s)`);
}

/**
 * Crank service: if any guess in the round already won, anyone may settle it —
 * we fetch the KMS proof for its win handle and submit the claim so winners
 * get paid even if they close the tab. The pot still goes to the guesser.
 */
async function crankWinningClaims(roundId: bigint): Promise<boolean> {
  const guesses = (await client.readContract({
    ...contract,
    functionName: "getGuesses",
    args: [roundId],
  })) as any[];

  for (let i = guesses.length - 1; i >= 0; i--) {
    const winHandle = guesses[i].winHandle as Hex;
    let win: { value: unknown; decryptionProof: Hex };
    try {
      win = (await handleClient.publicDecrypt(winHandle)) as any;
    } catch {
      continue; // colors not materialized yet — next poll will retry
    }
    if (win.value !== true) continue;

    console.log(`Round #${roundId}: guess #${i} WON — cranking claim…`);
    const hash = await client.writeContract({
      ...contract,
      functionName: "claim",
      args: [roundId, BigInt(i), win.decryptionProof],
      gas: GAS.claim,
      account: client.account!,
      chain: client.chain,
    });
    const receipt = await client.waitForTransactionReceipt({ hash });
    console.log(`  claim ${receipt.status} (${hash})`);
    return receipt.status === "success";
  }
  return false;
}

async function expireStaleRound(roundId: bigint, round: RoundInfo): Promise<boolean> {
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (now <= round.deadline + CLAIM_GRACE) return false;
  console.log(`Round #${roundId} expired unsolved — revealing & reclaiming pot…`);
  const hash = await client.writeContract({
    ...contract,
    functionName: "revealExpired",
    args: [roundId],
    gas: GAS.revealExpired,
    account: client.account!,
    chain: client.chain,
  });
  const receipt = await client.waitForTransactionReceipt({ hash });
  console.log(`  revealExpired ${receipt.status} (${hash})`);
  return receipt.status === "success";
}

async function tick(): Promise<void> {
  const roundId = await latestRoundId();
  if (roundId === null) {
    await createRound();
    return;
  }
  const round = await readRound(roundId);
  if (round.status !== 0) {
    // Latest round is settled — open the next one.
    await createRound();
    return;
  }
  // Open round: settle winners first, then check expiry.
  if (round.guessCount > 0 && (await crankWinningClaims(roundId))) {
    await createRound();
    return;
  }
  if (await expireStaleRound(roundId, round)) {
    await createRound();
    return;
  }
  const secondsLeft = Number(round.deadline) - Math.floor(Date.now() / 1000);
  console.log(
    `Round #${roundId} open — ${round.guessCount} guesses, ${Math.max(0, secondsLeft)}s left, pot intact. 🔒`,
  );
}

const once = process.argv.includes("--once");
if (once) {
  await tick();
} else {
  console.log(`Daemon mode: polling every ${POLL_MS / 1000}s. Ctrl-C to stop.`);
  for (;;) {
    try {
      await tick();
    } catch (error) {
      console.error(`tick failed: ${error instanceof Error ? error.message : error}`);
    }
    await sleep(POLL_MS);
  }
}
