import process from "node:process";
import { spawnSync } from "node:child_process";
import { nodeTestFiles, projectRoot } from "./test-files.mjs";

if (!nodeTestFiles.length) throw new Error("No node:test suites found.");

const result = spawnSync(process.execPath, [
  "--import", "tsx", "--test", "--test-concurrency=4", ...nodeTestFiles,
], { cwd: projectRoot, stdio: "inherit" });

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
