import { test, expect } from "vitest";
import { normalizeCompanyModulesEvent } from "./companyModuleSync";

test("normalizes company code and keeps unique valid module keys in canonical order", () => {
  expect(
    normalizeCompanyModulesEvent({ companyCode: " acme ", enabledModules: ["chat", "hr", "chat", "unknown"] })
  ).toEqual({ companyCode: "ACME", enabledModules: ["hr", "chat"] });
});

test("rejects malformed or empty module update events", () => {
  expect(normalizeCompanyModulesEvent(null)).toBeNull();
  expect(normalizeCompanyModulesEvent({ companyCode: "", enabledModules: ["hr"] })).toBeNull();
  expect(normalizeCompanyModulesEvent({ companyCode: "ACME", enabledModules: "hr" })).toBeNull();
  expect(normalizeCompanyModulesEvent({ companyCode: "ACME", enabledModules: [] })).toBeNull();
  expect(normalizeCompanyModulesEvent({ companyCode: "ACME", enabledModules: ["unknown"] })).toBeNull();
});
