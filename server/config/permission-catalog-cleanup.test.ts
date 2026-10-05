import { describe, expect, it } from "vitest";
import {
  PERMISSION_CATALOG,
  PERMISSION_FEATURES,
  PermissionValidationError,
  compactStoredPermissions,
  expandEffectivePermissions,
  isPermissionCode,
} from "./permission-catalog";

const EXPECTED_FEATURES = ["access", "chat", "dashboard", "hr", "meetings", "people", "relationship", "resource", "settings"];

describe("permission registry", () => {
it("contains exactly one read/manage pair for every approved feature", () => {
  expect(PERMISSION_FEATURES.map((entry) => entry.feature).sort()).toEqual(EXPECTED_FEATURES);
  expect(PERMISSION_CATALOG).toHaveLength(EXPECTED_FEATURES.length * 2);
  for (const feature of EXPECTED_FEATURES) {
    expect(
      PERMISSION_CATALOG.filter((entry) => entry.feature === feature).map((entry) => entry.action).sort(),
    ).toEqual(["manage", "read"]);
  }
  expect(new Set(PERMISSION_CATALOG.map((entry) => entry.code)).size).toBe(PERMISSION_CATALOG.length);
});

it("recognizes only registered read/manage codes", () => {
  expect(isPermissionCode("people:read")).toBe(true);
  expect(isPermissionCode("people:manage")).toBe(true);
  expect(isPermissionCode("meetings:read")).toBe(true);
  expect(isPermissionCode("meetings:manage")).toBe(true);
  expect(isPermissionCode("resource:manage")).toBe(true);
  expect(isPermissionCode("access:manage")).toBe(true);
  expect(isPermissionCode("payroll:pay")).toBe(false);
  expect(isPermissionCode("unknown:manage")).toBe(false);
});

it("compacts redundant read while returning effective permissions", () => {
  expect(compactStoredPermissions([
    "hr:read",
    "hr:manage",
    "resource:read",
  ])).toEqual({
    stored: ["hr:manage", "resource:read"],
    effective: ["hr:manage", "hr:read", "resource:read"],
  });
});

it("rejects every invalid code instead of silently dropping it", () => {
  expect(() => compactStoredPermissions(["hr:read", "student:manage", "finance:collect"]))
    .toThrowError(expect.objectContaining({
      name: PermissionValidationError.name,
      invalidCodes: ["finance:collect", "student:manage"],
    }));
});

it("manage expands to read without crossing feature boundaries", () => {
  expect(
    [...expandEffectivePermissions(["resource:manage", "meetings:read"])].sort(),
  ).toEqual(["meetings:read", "resource:manage", "resource:read"]);
});
});
