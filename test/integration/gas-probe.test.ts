import { describe, it } from "node:test";
import { parseEther, type Hex } from "viem";
import { nox } from "@iexec-nox/nox-hardhat-plugin";
import { waitForHandleResolved } from "../utils/handle-gateway.js";

/**
 * Not an assertion suite — measures real gas of every Nox-touching write so
 * the Sepolia scripts/frontend can set explicit, informed gas limits
 * (MetaMask/RPCs cannot estimate Nox precompile calls). Prints to stdout.
 */

const l = (word: string) => [...word].map((c) => c.charCodeAt(0) - 97);

describe("gas probe", () => {
  it("measures createRound / guess / claim / revealExpired", { timeout: 600_000 }, async () => {
    const { viem } = await nox.connect();
    const publicClient = await viem.getPublicClient();
    const game = await viem.deployContract("CryptoWordle", []);

    const report: Record<string, bigint> = {};

    const handles: Hex[] = [];
    const proofs: Hex[] = [];
    for (const letter of l("abbey")) {
      const enc = await nox.encryptInput(BigInt(letter), "uint256", game.address);
      handles.push(enc.handle);
      proofs.push(enc.handleProof);
    }
    let tx = await game.write.createRound([handles, proofs, 3600n], {
      value: parseEther("0.1"),
    });
    let rcpt = await publicClient.waitForTransactionReceipt({ hash: tx });
    report.createRound = rcpt.gasUsed;

    tx = await game.write.guess([0n, l("kebab")]);
    rcpt = await publicClient.waitForTransactionReceipt({ hash: tx });
    report.guess = rcpt.gasUsed;

    tx = await game.write.guess([0n, l("abbey")]);
    rcpt = await publicClient.waitForTransactionReceipt({ hash: tx });
    report.guessWinning = rcpt.gasUsed;

    const g = (await game.read.getGuess([0n, 1n])) as any;
    await waitForHandleResolved(g.winHandle, { timeoutMs: 300_000 });
    const { decryptionProof } = await nox.publicDecrypt(g.winHandle);
    tx = await game.write.claim([0n, 1n, decryptionProof]);
    rcpt = await publicClient.waitForTransactionReceipt({ hash: tx });
    report.claim = rcpt.gasUsed;

    // NOTE: revealExpired is deliberately NOT measured here. It needs an
    // evm_increaseTime warp of deadline+grace (~25 min), and NoxCompute input
    // proofs expire 1 hour after their gateway timestamp — the whole test run
    // shares one chain, so the suite has a TOTAL warp budget of < 60 min,
    // already spent by the expiry tests in cryptowordle.test.ts and
    // treasury.test.ts. Last standalone measurement: revealExpired = 517,516.

    console.log("\n=== GAS REPORT ===");
    for (const [fn, gas] of Object.entries(report)) {
      console.log(`${fn}: ${gas.toString()}`);
    }
  });
});
