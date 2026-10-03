import { expect, it } from "vitest";
import { compactStoredPermissions, expandEffectivePermissions } from "./permission-catalog";
it("retains active permissions when old clients resubmit retired timekeeping codes", () => {
  expect(compactStoredPermissions(["timekeeping:manage", "timekeeping:read", "access:manage", "chat:read"])).toEqual({ stored: ["access:manage", "chat:read"], effective: ["access:manage", "access:read", "chat:read"] });
  expect([...expandEffectivePermissions(["timekeeping:manage", "chat:read"])]).toEqual(["chat:read"]);
});
it("continues rejecting unrelated invalid permissions", () => {
  expect(() => compactStoredPermissions(["unknown:manage"])).toThrow();
});
