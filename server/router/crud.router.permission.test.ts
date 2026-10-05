import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ permission: vi.fn(), auth: vi.fn() }));
vi.mock("../middleware/auth", () => ({ requireAuth: mocks.auth, requirePermission: (code: string) => (req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) => mocks.permission(code, req, res, next) }));
import { crudRouter, crudReadPermissionGuard } from "./crud.router";
beforeEach(() => vi.clearAllMocks());
it.each(["hr-leave-templates", "hr-leave-applications", "timekeeping", "unknown"])("rejects retired or unknown resource %s", (modelName) => {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  const next = vi.fn();
  crudReadPermissionGuard(({ params: { modelName } } as unknown as Parameters<typeof crudReadPermissionGuard>[0]), ((res) as unknown as Parameters<typeof crudReadPermissionGuard>[1]), next);
  expect(res.status).toHaveBeenCalledWith(404);
  expect(next).not.toHaveBeenCalled();
  expect(mocks.permission).not.toHaveBeenCalled();
});
it("requires user read permission for the remaining member endpoint", () => {
  const req = { params: { modelName: "users" } }; const res = {}; const next = vi.fn();
  crudReadPermissionGuard((req as unknown as Parameters<typeof crudReadPermissionGuard>[0]), ((res) as unknown as Parameters<typeof crudReadPermissionGuard>[1]), next);
  expect(mocks.permission).toHaveBeenCalledWith("access:read", req, res, next);
});
it("has no generic mutation endpoint and authenticates every read", () => {
  const routes = crudRouter.stack.filter((layer) => layer.route).map((layer) => layer.route);
  expect(routes).toHaveLength(2);
  for (const route of routes) {
    expect(route.methods).toEqual({ get: true });
    expect(route.stack[0].handle).toBe(mocks.auth);
  }
});
