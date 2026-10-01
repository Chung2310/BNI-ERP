import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_MODULE_KEYS, MODULE_KEYS } from "../config/module-keys";
import { DEFAULT_ROLE_PERMISSIONS } from "../middleware/auth";

test("core modules are defined", () => {
  assert.ok(MODULE_KEYS.includes("hr" as any));
  assert.ok(MODULE_KEYS.includes("resource" as any));
  assert.ok(MODULE_KEYS.includes("chat" as any));
  assert.ok(DEFAULT_MODULE_KEYS.includes("hr" as any));
});

test("default administrators have core permissions", () => {
  assert.ok(DEFAULT_ROLE_PERMISSIONS.admin.includes("hr:manage"));
  assert.ok(DEFAULT_ROLE_PERMISSIONS.admin.includes("resource:view"));
  assert.ok(DEFAULT_ROLE_PERMISSIONS.admin.includes("chat:manage"));
});
