import { parseEther, type Hex } from "viem";
import {
  GAS,
  encryptWord,
  lettersToWord,
  loadArtifact,
  loadDeployment,
  makeClient,
  makeHandleClient,
  withKmsRetry,
  wordToLetters,
} from "../service/common.ts";

/**
 * End-to-end sanity check ON SEPOLIA against the real KMS — run once after
 * deployment. Creates a throwaway round (tiny pot), plays it, and settles it:
 *
 *   createRound → wrong guess → publicDecrypt colors → right guess →
 *   publicDecrypt win + proof → claim → verify payout → decrypt revealed word
 *
 * The script knows the word (it created the round) — that's fine for a probe;
 * real rounds come from the round generator, which discards it.
 */

const SECRET = "vapor";
const WRONG = "porch"; // p,o,r present-elsewhere vs vapor → expect yellows
const POT = "0.001";

const client = makeClient();
const handleClient = await makeHandleClient(client);
const { abi } = loadArtifact();
const deployment = loadDeployment();
const contract = { address: deployment.address, abi } as const;
const me = client.account!.address;

console.log(`Sanity check on Sepolia — CryptoWordle @ ${deployment.address}`);
console.log(`Wallet ${me}\n`);

// -- 1. Create round ---------------------------------------------------------
console.log(`[1/6] createRound (pot ${POT} ETH)…`);
const { handles, proofs } = await encryptWord(handleClient, SECRET, deployment.address);
let hash = await client.writeContract({
  ...contract,
  functionName: "createRound",
  args: [handles, proofs, 3600n],
  value: parseEther(POT),
  gas: GAS.createRound,
  account: client.account!,
  chain: client.chain,
});
await client.waitForTransactionReceipt({ hash });
const roundId =
  ((await client.readContract({ ...contract, functionName: "roundCount" })) as bigint) - 1n;
console.log(`  round #${roundId} created — https://sepolia.etherscan.io/tx/${hash}`);

// -- 2. Wrong guess ----------------------------------------------------------
console.log(`[2/6] guess "${WRONG}"…`);
hash = await client.writeContract({
  ...contract,
  functionName: "guess",
  args: [roundId, wordToLetters(WRONG)],
  gas: GAS.guess,
  account: client.account!,
  chain: client.chain,
});
await client.waitForTransactionReceipt({ hash });
console.log(`  guessed — https://sepolia.etherscan.io/tx/${hash}`);

// -- 3. Decrypt colors (KMS latency: retry) -----------------------------------
console.log(`[3/6] publicDecrypt colors (KMS may take a minute)…`);
let g = (await client.readContract({
  ...contract,
  functionName: "getGuess",
  args: [roundId, 0n],
})) as any;
const colors: bigint[] = [];
for (const [i, h] of (g.colorHandles as Hex[]).entries()) {
  const { value } = await withKmsRetry(`color[${i}]`, () => handleClient.publicDecrypt(h));
  colors.push(value as bigint);
}
const emoji = colors.map((c) => (c === 2n ? "🟩" : c === 1n ? "🟨" : "⬜")).join("");
console.log(`  colors: ${colors.join(",")}  ${emoji}`);
const { value: wrongWin } = await withKmsRetry("win[0]", () =>
  handleClient.publicDecrypt(g.winHandle as Hex),
);
if (wrongWin !== false) throw new Error("BUG: wrong guess decrypted as a win!");

// -- 4. Winning guess ---------------------------------------------------------
console.log(`[4/6] guess "${SECRET}" (the word)…`);
hash = await client.writeContract({
  ...contract,
  functionName: "guess",
  args: [roundId, wordToLetters(SECRET)],
  gas: GAS.guess,
  account: client.account!,
  chain: client.chain,
});
await client.waitForTransactionReceipt({ hash });

g = (await client.readContract({
  ...contract,
  functionName: "getGuess",
  args: [roundId, 1n],
})) as any;
const win = await withKmsRetry("win[1]", () =>
  handleClient.publicDecrypt(g.winHandle as Hex),
);
if (win.value !== true) throw new Error("BUG: correct guess did not decrypt as a win!");
console.log(`  win handle decrypts true ✔`);

// -- 5. Claim (trustless, proof verified on-chain) ----------------------------
console.log(`[5/6] claim with KMS proof…`);
const balanceBefore = await client.getBalance({ address: me });
hash = await client.writeContract({
  ...contract,
  functionName: "claim",
  args: [roundId, 1n, (win as any).decryptionProof],
  gas: GAS.claim,
  account: client.account!,
  chain: client.chain,
});
const claimReceipt = await client.waitForTransactionReceipt({ hash });
if (claimReceipt.status !== "success") throw new Error("claim reverted");
const balanceAfter = await client.getBalance({ address: me });
console.log(
  `  pot received (Δ ≈ ${Number(balanceAfter - balanceBefore) / 1e18} ETH incl. gas) — https://sepolia.etherscan.io/tx/${hash}`,
);

// -- 6. Post-round reveal ------------------------------------------------------
console.log(`[6/6] decrypt revealed secret…`);
const [, , , status, winner, , revealedHandles] = (await client.readContract({
  ...contract,
  functionName: "getRound",
  args: [roundId],
})) as any[];
if (status !== 1) throw new Error(`round status ${status}, expected Solved`);
if (winner.toLowerCase() !== me.toLowerCase()) throw new Error("wrong winner recorded");
const letters: bigint[] = [];
for (const [i, h] of (revealedHandles as Hex[]).entries()) {
  const { value } = await withKmsRetry(`letter[${i}]`, () => handleClient.publicDecrypt(h));
  letters.push(value as bigint);
}
const revealed = lettersToWord(letters);
console.log(`  revealed word: "${revealed}"`);
if (revealed !== SECRET) throw new Error(`BUG: revealed "${revealed}" ≠ "${SECRET}"`);

console.log(`\nSanity check PASSED ✔ — full confidential loop works on Sepolia.`);
