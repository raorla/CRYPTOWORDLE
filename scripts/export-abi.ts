import { readFileSync, writeFileSync } from "node:fs";

const artifact = JSON.parse(
  readFileSync(
    new URL("../artifacts/contracts/CryptoWordle.sol/CryptoWordle.json", import.meta.url),
    "utf8",
  ),
);
const header = `// CryptoWordle ABI — extracted from the compiled artifact so the frontend
// and any fresh clone build without running hardhat compile first.
// Regenerate after contract changes: npm run export-abi

export const CRYPTOWORDLE_ABI = `;
writeFileSync(
  new URL("../shared/abi.ts", import.meta.url),
  header + JSON.stringify(artifact.abi, null, 2) + " as const;\n",
);
console.log("shared/abi.ts regenerated");
