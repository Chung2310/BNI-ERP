import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import path from "node:path";

export const projectRoot = fileURLToPath(new URL("../", import.meta.url));

function findTestFiles(directory) {
  return readdirSync(path.join(projectRoot, directory), { withFileTypes: true })
    .flatMap(entry => {
      const relativePath = directory + "/" + entry.name;
      if (entry.isDirectory()) return findTestFiles(relativePath);
      return /\.test\.tsx?$/.test(entry.name) ? [relativePath] : [];
    });
}

// Vitest and node:test have separate runners; neither runner should collect the other's suites.
export const nodeTestFiles = ["src", "server"].flatMap(findTestFiles)
  .filter(file => /from\s*["']node:test["']/.test(readFileSync(path.join(projectRoot, file), "utf8")))
  .sort();
