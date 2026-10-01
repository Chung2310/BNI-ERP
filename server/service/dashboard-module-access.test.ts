import assert from "node:assert/strict";
import test from "node:test";
import { resolveDashboardModuleAccess } from "./dashboard-module-access";

test("dashboard enables only the tenant modules selected by the company", () => {
  assert.deepEqual(resolveDashboardModuleAccess({ role: "manager", enabledModules: ["hr", "chat"], permissions: new Set(["hr:read", "chat:read", "timekeeping:read"]) }), {
    hr: true,
    chat: true,
    resource: false,
    timekeeping: true,
  });
});

test("legacy tenants and admins retain access to every dashboard module", () => {
  assert.deepEqual(resolveDashboardModuleAccess({ role: "user", enabledModules: undefined }), {
    hr: true,
    chat: true,
    resource: true,
    timekeeping: true,
  });
  assert.deepEqual(resolveDashboardModuleAccess({ role: "admin", enabledModules: [] }), {
    hr: true,
    chat: true,
    resource: true,
    timekeeping: true,
  });
});
