import assert from "node:assert/strict";
import test from "node:test";
import { resolveProfileEnabledModules } from "./auth-profile-modules";

test("returns the company's enabled modules", () => {
  assert.deepEqual(resolveProfileEnabledModules(["hr", "chat"]), ["hr", "chat"]);
});

test("missing or empty company modules resolve to general modules", () => {
  assert.deepEqual(resolveProfileEnabledModules(undefined), ["hr", "resource", "chat"]);
  assert.deepEqual(resolveProfileEnabledModules([]), ["hr", "resource", "chat"]);
});

test("invalid company module keys are removed", () => {
  assert.deepEqual(resolveProfileEnabledModules(["student", "unknown"]), ["hr", "resource", "chat"]);
});

test("legacy labor profile does not restore retired student or worker modules", () => {
  assert.deepEqual(resolveProfileEnabledModules(["student", "hr"], "labor"), ["hr"]);
});

test("legacy education profile keeps only active modules", () => {
  assert.deepEqual(resolveProfileEnabledModules(["worker", "student", "chat"], "education"), ["chat"]);
});
