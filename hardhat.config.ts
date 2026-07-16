import "dotenv/config";
import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { configVariable, defineConfig } from "hardhat/config";
import noxPlugin from "@iexec-nox/nox-hardhat-plugin";

// Explicit, generous settings: Nox precompile-heavy functions (a Wordle guess
// runs ~100 encrypted ops) need viaIR to fit stack limits and benefit from the
// optimizer. evmVersion cancun matches OZ 5.x (mcopy).
export default defineConfig({
  plugins: [hardhatToolboxViemPlugin, noxPlugin],
  solidity: {
    version: "0.8.35",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
      evmVersion: "cancun",
    },
  },
  networks: {
    default: {
      type: "edr-simulated",
      chainType: "op",
    },
    sepolia: {
      type: "http",
      chainType: "l1",
      url: configVariable("SEPOLIA_RPC_URL"),
      chainId: 11155111,
      accounts: [configVariable("DEPLOYER_PRIVATE_KEY")],
    },
  },
});
