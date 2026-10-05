import assert from "node:assert/strict";
import test from "node:test";
import { filterModulesForBusinessType, resolveBusinessType, BUSINESS_TYPES } from "./business-types";

test("only exposes general business type", () => {
  assert.deepEqual(BUSINESS_TYPES, ["general"]);
});

test("resolves business type with default fallback to general", () => {
  assert.equal(resolveBusinessType("general"), "general");
  assert.equal(resolveBusinessType(undefined), "general");
});

test("keeps valid module keys while sanitizing unknown modules", () => {
  assert.deepEqual(filterModulesForBusinessType(["hr", "resource", "chat", "unknown"], "general"), ["hr", "resource", "chat"]);
});

