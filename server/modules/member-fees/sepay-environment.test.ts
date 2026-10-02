import { expect, it } from "vitest";
import { resolveSePayEnvironment } from "./sepay-environment";
const valid = { SEPAY_ENABLED: "true", SEPAY_COMPANY_CODE: "BNI", SEPAY_BANK: "Vietcombank",
  SEPAY_ACCOUNT_NUMBER: "123456789", SEPAY_ACCOUNT_NAME: "BNI", SEPAY_API_KEY: "a".repeat(40) };
it("accepts trimmed configuration and normalizes enabled and company casing", () => {
  const result = resolveSePayEnvironment(" bni ", { ...valid, SEPAY_ENABLED: " TRUE ", SEPAY_API_KEY: " " + valid.SEPAY_API_KEY + " " });
  expect(result.config?.enabled).toBe(true);
  expect(result.issues).toEqual([]);
});
it("does not expose a different organization's account", () => {
  const result = resolveSePayEnvironment("OTHER", valid);
  expect(result.config).toBeNull();
  expect(result.issues.join(" ")).toContain("SEPAY_COMPANY_CODE");
  expect(JSON.stringify(result)).not.toContain(valid.SEPAY_ACCOUNT_NUMBER);
  expect(JSON.stringify(result)).not.toContain(valid.SEPAY_API_KEY);
});
it.each(Object.keys(valid))("identifies a missing %s without reporting secrets", key => {
  const result = resolveSePayEnvironment("BNI", { ...valid, [key]: "" });
  expect(result.config?.enabled || false).toBe(false);
  expect(result.issues.join(" ")).toContain(key);
  expect(JSON.stringify(result.issues)).not.toContain(valid.SEPAY_API_KEY);
});
it("explains an invalid webhook key", () => {
  const result = resolveSePayEnvironment("BNI", { ...valid, SEPAY_API_KEY: "short" });
  expect(result.config?.enabled).toBe(false);
  expect(result.issues.join(" ")).toContain("32–200");
});
