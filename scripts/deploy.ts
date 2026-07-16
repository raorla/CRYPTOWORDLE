import { loadArtifact, makeClient, saveDeployment } from "../service/common.ts";

/**
 * Deploys CryptoWordle to ETH Sepolia and records the address + deploy block
 * in deployments/sepolia.json (committed — it's the frontend's source of
 * truth and the lower bound for event scans).
 *
 * Usage: npm run deploy:sepolia
 */

const client = makeClient();
const { abi, bytecode } = loadArtifact();

console.log(`Deployer: ${client.account!.address}`);
const balance = await client.getBalance({ address: client.account!.address });
console.log(`Balance:  ${Number(balance) / 1e18} ETH`);
if (balance < 10n ** 16n) {
  throw new Error("Deployer balance below 0.01 ETH — top up Sepolia ETH first.");
}

console.log("Deploying CryptoWordle…");
const hash = await client.deployContract({
  abi,
  bytecode,
  args: [],
  account: client.account!,
  chain: client.chain,
});
console.log(`  tx: ${hash}`);
const receipt = await client.waitForTransactionReceipt({ hash });
if (receipt.status !== "success" || !receipt.contractAddress) {
  throw new Error(`Deployment failed: ${JSON.stringify(receipt.status)}`);
}

const deployment = {
  chainId: 11155111,
  address: receipt.contractAddress,
  deployBlock: Number(receipt.blockNumber),
  txHash: hash,
  deployedAt: new Date().toISOString(),
};
saveDeployment(deployment);

console.log(`\nCryptoWordle deployed ✔`);
console.log(`  address: ${deployment.address}`);
console.log(`  block:   ${deployment.deployBlock}`);
console.log(`  https://sepolia.etherscan.io/address/${deployment.address}`);
console.log(`\nSaved to deployments/sepolia.json`);
