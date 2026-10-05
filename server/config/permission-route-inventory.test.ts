import { describe, expect, it } from "vitest";
import {
  permissionRouteDiagnostics,
  PUBLIC_ROUTE_EXCEPTIONS,
  scanPermissionRouteInventory,
  scanPermissionRouteSource,
  type PermissionRouteDiagnostic,
} from "./permission-route-inventory";

describe("permission route inventory", () => {
  it("extracts mutation routes and their canonical permission guards", () => {
    const routes = scanPermissionRouteSource(
      `
        router.post("/items", requireAuth, requirePermission("inventory:manage"), handler);
        router.get("/items", requireAuth, requirePermission("inventory:read"), handler);
      `,
      "fixture.router.ts",
    );

    expect(routes).toEqual([
      expect.objectContaining({ method: "POST", path: "/items", permissionCodes: ["inventory:manage"] }),
      expect.objectContaining({ method: "GET", path: "/items", permissionCodes: ["inventory:read"] }),
    ]);
  });

  it("resolves a local permission alias used as route middleware", () => {
    const [route] = scanPermissionRouteSource(`
      const RESOURCE_MANAGE_PERMISSION = "resource:manage";
      const operate = requirePermission([RESOURCE_MANAGE_PERMISSION]);
      router.post("/x", operate, handler);
    `, "fixture.router.ts");
    expect(route.permissionCodes).toEqual(["resource:manage"]);
    expect(route.diagnostics).toEqual([]);
  });

  it("reports missing and unknown guards with source, method, and path", () => {
    const diagnostics: PermissionRouteDiagnostic[] = scanPermissionRouteSource(
      `
        router.post("/open", requireAuth, handler);
        router.patch("/bad", requireAuth, requirePermission("not-a-code"), handler);
      `,
      "fixture.router.ts",
    ).flatMap((route) => route.diagnostics);

    expect(diagnostics).toEqual([
      expect.objectContaining({ sourceFile: "fixture.router.ts", method: "POST", path: "/open", kind: "missing-permission" }),
      expect.objectContaining({ sourceFile: "fixture.router.ts", method: "PATCH", path: "/bad", kind: "unknown-permission" }),
    ]);
  });

  it("reports authorization actions outside read and manage", () => {
    const [route] = scanPermissionRouteSource(
      `router.post("/approve", requireAuth, requirePermission("payroll-period:approve"), handler);`,
      "fixture.router.ts",
    );

    expect(route.diagnostics).toContainEqual(expect.objectContaining({
      kind: "unknown-permission-action",
      path: "/approve",
    }));
  });

  it("allows explicitly documented public webhook exceptions", () => {
    const [route] = scanPermissionRouteSource(
      `webhookRouter.post("/payment", handler);`,
      "server/router/webhook.router.ts",
      {},
      { mounts: { webhookRouter: "/webhook" } },
    );

    expect(route.diagnostics).toEqual([]);
    expect(scanPermissionRouteSource(`webhookRouter.post("/payment", handler);`, "server/router/webhook.router.ts", {}, { mounts: { webhookRouter: "/private" } })[0].diagnostics).not.toEqual([]);
  });

  it("documents the signed Google Drive OAuth callback as a public protocol exception", () => {
    expect(PUBLIC_ROUTE_EXCEPTIONS).toContainEqual(expect.objectContaining({
      sourceFile: "server/router/google-drive.router.ts",
      router: "googleDriveRouter",
      mount: "/integrations/google-drive",
      method: "GET",
      path: "/callback",
    }));
  });

  it("does not treat a handler-body alias as route middleware", () => {
    const [route] = scanPermissionRouteSource(`router.post("/x", requireAuth, (req, res) => { const operate = requirePermission("hr:manage"); });`, "fixture.router.ts");
    expect(route.permissionCodes).toEqual([]);
  });

  it("inherits permission guards from router-level middleware and named wrappers", () => {
    const routes = scanPermissionRouteSource(`
      const read = requirePermission("chat:read");
      async function readGuard(req, res, next) { return read(req, res, next); }
      router.use(requireAuth, readGuard);
      router.post("/rooms", handler);
    `, "fixture.router.ts");
    expect(routes[0]).toMatchObject({ permissionCodes: ["chat:read"], diagnostics: [] });
  });

  it("scans the repository router inventory", () => {
    const routes = scanPermissionRouteInventory(process.cwd());
    const diagnostics = permissionRouteDiagnostics(process.cwd());
    expect(routes.length).toBeGreaterThan(0);
    expect(diagnostics.every((item) => item.sourceFile && item.method && item.path && item.kind)).toBe(true);
  });
});
