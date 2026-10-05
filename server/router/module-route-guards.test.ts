import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_MODULE_KEYS, MODULE_KEYS } from "../config/module-keys";
import { DEFAULT_ROLE_PERMISSIONS } from "../middleware/auth";

test("core modules are defined", () => {
  assert.ok(MODULE_KEYS.includes("hr"));
  assert.ok(MODULE_KEYS.includes("resource"));
  assert.ok(MODULE_KEYS.includes("chat"));
  assert.ok(DEFAULT_MODULE_KEYS.includes("hr"));
});

test("default administrators have core permissions", () => {
  assert.ok(DEFAULT_ROLE_PERMISSIONS.admin.includes("hr:manage"));
  assert.ok(DEFAULT_ROLE_PERMISSIONS.admin.includes("resource:manage"));
  assert.ok(DEFAULT_ROLE_PERMISSIONS.admin.includes("chat:manage"));
});
