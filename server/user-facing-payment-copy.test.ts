import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";

const userFacingFiles = [
  "src/pages/Header.tsx",
  "src/pages/Sidebar.tsx",
  "src/seo/seo-config.ts",
];

test("user-facing payment copy does not expose the PayOS provider name", () => {
  for (const file of userFacingFiles) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /["'`][^"'`\r\n]*payos[^"'`\r\n]*["'`]/i, file);
  }

  assert.equal(existsSync("src/pages/WalletTab.tsx"), false, "Legacy wallet page must remain retired");
  assert.equal(existsSync("server/controller/wallet.controller.ts"), false, "Legacy wallet controller must remain retired");
});
