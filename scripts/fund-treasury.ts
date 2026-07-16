import { formatEther, parseEther } from "viem";
import { loadArtifact, loadDeployment, makeClient } from "../service/common.ts";

/**
 * Deposits ETH into the CryptoWordle on-chain treasury — the auditable house
 * bankroll that funds round pots.
 *
 * Usage: npm run treasury:fund -- 0.5
 */

const amountArg = process.argv.find((a) => /^\d+(\.\d+)?$/.test(a));
if (!amountArg) {
  throw new Error("Usage: npm run treasury:fund -- <amount-in-eth>  (e.g. 0.5)");
}
const amount = parseEther(amountArg);

const client = makeClient();
const { abi } = loadArtifact();
const deployment = loadDeployment();

const balance = await client.getBalance({ address: client.account!.address });
if (balance < amount + parseEther("0.01")) {
  throw new Error(
    `Wallet holds ${formatEther(balance)} ETH — not enough to deposit ${amountArg} + gas.`,
  );
}

console.log(`Depositing ${amountArg} ETH into the treasury @ ${deployment.address}…`);
const hash = await client.writeContract({
  address: deployment.address,
  abi,
  functionName: "fundTreasury",
  value: amount,
  gas: 100_000n,
  account: client.account!,
  chain: client.chain,
});
console.log(`  tx: ${hash}`);
const receipt = await client.waitForTransactionReceipt({ hash });
if (receipt.status !== "success") throw new Error("fundTreasury reverted");

const treasury = (await client.readContract({
  address: deployment.address,
  abi,
  functionName: "treasury",
})) as bigint;
console.log(`Treasury now holds ${formatEther(treasury)} ETH ✔`);
console.log(
  `Anyone can verify: https://eth-sepolia.blockscout.com/address/${deployment.address}`,
);
