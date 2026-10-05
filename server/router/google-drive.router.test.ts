import { describe, expect, it, vi } from "vitest";

const guards = vi.hoisted(() => new Map<import("express").RequestHandler, string | string[]>());

vi.mock("../middleware/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware/auth")>();
  return {
    ...actual,
    requirePermission: (permission: string | string[]) => {
      const guard = (_req: import("express").Request, _res: import("express").Response, next: import("express").NextFunction) => next();
      guards.set(guard, permission);
      return guard;
    },
  };
});

import { googleDriveRouter } from "./google-drive.router";

const permissionOf = (method: string, path: string) => {
  const layer = (googleDriveRouter).stack.find((item) => (
    item.route?.path === path && item.route?.methods?.[method.toLowerCase()]
  ));
  if (!layer) return undefined;
  return layer.route.stack
    .map((handler) => guards.get(handler.handle))
    .find((permission: string | undefined) => permission !== undefined);
};

describe("Google Drive route permissions", () => {
  it.each([
    ["GET", "/resources"],
    ["GET", "/resources/group/:roomId"],
  ])("allows resource readers to call %s %s", (method, path) => {
    expect(permissionOf(method, path)).toBe("resource:read");
  });

  it.each([
    ["POST", "/upload"],
    ["POST", "/upload/group/:roomId"],
    ["POST", "/create-file"],
    ["PUT", "/groups/:roomId/permissions"],
    ["DELETE", "/resources/:id"],
    ["POST", "/resources/move"],
    ["PATCH", "/resources/:id/rename"],
  ])("requires resource management for %s %s", (method, path) => {
    expect(permissionOf(method, path)).toBe("resource:manage");
  });

  it("does not expose a protected Drive route without a permission guard", () => {
    const unguarded = (googleDriveRouter).stack
      .filter((item) => !item.route.stack.some((handler) => guards.has(handler.handle)))
      .map((item) => item.route.path);

    expect(unguarded).toEqual([]);
  });
});

it("removes personal Drive OAuth endpoints", () => {
  const paths = (googleDriveRouter).stack.map((item) => item.route?.path);
  expect(paths).not.toContain("/auth-url");
  expect(paths).not.toContain("/callback");
  expect(paths).not.toContain("/disconnect");
});
