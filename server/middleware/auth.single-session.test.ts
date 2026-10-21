import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import type { Response } from "express";
import { UserModel } from "../model/user.model";
import { requireAuth } from "./auth";
import { getJwtAccessSecret } from "../config/env";

function makeResponse() {
  return {
    statusCode: 200,
    body: undefined,
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
  };
}

function invoke(token: string, activeSessionId: string, userExists = true, path = "/api/v1/auth/me", method = "GET") {
  vi.spyOn(UserModel, "findById").mockReturnValue(({
    select: () => ({
      lean: async () => userExists ? ({ branchId: "branch-1", activeSessionId, displayName: "Nguyễn An" }) : null,
    }),
  } as unknown as Parameters<((value: ReturnType<typeof UserModel.findById>) => void)>[0]));
  const req = { headers: { authorization: `Bearer ${token}` }, method, originalUrl: path } as Parameters<typeof requireAuth>[0];
  const res = makeResponse();
  let passed = false;
  return requireAuth((req as unknown as Parameters<typeof requireAuth>[0]), res as unknown as Response, () => { passed = true; }).then(() => ({ req, res, passed }));
}

describe("requireAuth concurrent device sessions", () => {
  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET ||= "test-access-secret-at-least-32-characters";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("accepts a valid access token from a different device", async () => {
    const token = jwt.sign({ id: "user-1", email: "user@example.com", role: "user", companyCode: "ACME", sid: "old-session" }, getJwtAccessSecret(), { expiresIn: "15m" });
    const result = await invoke(token, "new-session");

    assert.equal(result.passed, true);
    assert.equal(result.res.statusCode, 200);
    assert.equal(result.req.user.sessionId, "old-session");
  });

  it("accepts an existing token without a device identifier", async () => {
    const token = jwt.sign({ id: "user-1", email: "user@example.com", role: "user" }, getJwtAccessSecret(), { expiresIn: "15m" });
    assert.equal((await invoke(token, "another-device")).passed, true);
  });

  it.each(["invalid", "expired", "deleted"])("rejects %s credentials", async (scenario) => {
    const token = scenario === "invalid" ? "invalid-token" : jwt.sign(
      { id: "user-1", role: "user", sid: "device" },
      getJwtAccessSecret(),
      { expiresIn: scenario === "expired" ? -1 : "15m" },
    );
    const result = await invoke(token, "device", scenario !== "deleted");
    assert.equal(result.passed, false);
    assert.equal(result.res.statusCode, 401);
  });

  it("accepts a regular access token with the current session", async () => {
    const token = jwt.sign({ id: "user-1", email: "user@example.com", role: "user", companyCode: "ACME", sid: "current-session" }, getJwtAccessSecret(), { expiresIn: "15m" });
    const result = await invoke(token, "current-session");

    assert.equal(result.passed, true);
    assert.equal(result.req.user.sessionId, "current-session");
    assert.equal(result.req.user.displayName, "Nguyễn An");
  });

  it("allows a Chapter applicant to manage personal notifications and push devices only", async () => {
    const token = jwt.sign({ id: "applicant", email: "applicant@example.com", role: "user" }, getJwtAccessSecret());
    assert.equal((await invoke(token, "device", true, "/api/v1/notifications")).passed, true);
    assert.equal((await invoke(token, "device", true, "/api/v1/push/mobile/subscribe", "POST")).passed, true);
    const blocked = await invoke(token, "device", true, "/api/v1/meetings");
    assert.equal(blocked.passed, false);
    assert.equal(blocked.res.statusCode, 403);
  });
});
