import bcrypt from "bcryptjs";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { UserModel } from "../model/user.model";
import { CompanyModel } from "../model/company.model";
import { authService } from "./auth.service";
import { getJwtAccessSecret, getJwtRefreshSecret } from "../config/env";
import * as socketModule from "../socket";

function makeUser(activeSessionId = "") {
  return {
    _id: "user-1",
    email: "user@example.com",
    password: bcrypt.hashSync("password123", 4),
    role: "user",
    companyCode: "ACME",
    activeSessionId,
    activeSessionIssuedAt: undefined as Date | undefined,
    activeSessionLastSeenAt: undefined as Date | undefined,
    activeSessionUserAgent: "",
    activeSessionIp: "",
    save: vi.fn(async function (this: any) { return this; }),
  } as any;
}

describe("regular user concurrent device sessions", () => {
  let user: any;
  const originalUserFindOne = UserModel.findOne;
  const originalUserFindById = UserModel.findById;
  const originalCompanyFindOne = CompanyModel.findOne;

  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET ||= "test-access-secret-at-least-32-characters";
    process.env.JWT_REFRESH_SECRET ||= "test-refresh-secret-at-least-32-characters";
    user = makeUser();
    (UserModel as any).findOne = async () => user;
    (UserModel as any).findById = async () => user;
    (CompanyModel as any).findOne = () => ({ select: () => ({ lean: async () => ({ lifecycleStatus: "active" }) }) });
  });

  afterEach(() => {
    UserModel.findOne = originalUserFindOne;
    UserModel.findById = originalUserFindById;
    CompanyModel.findOne = originalCompanyFindOne;
    socketModule.setEmitToUserSessionMockForTesting(null);
    vi.restoreAllMocks();
  });

  it("issues separate device tokens without changing the account's existing session", async () => {
    user.activeSessionId = "legacy-device";
    const first = await authService.login("user@example.com", "password123");
    const second = await authService.login("user@example.com", "password123");
    const firstRefresh = jwt.verify(first.refreshToken, getJwtRefreshSecret()) as any;
    const secondRefresh = jwt.verify(second.refreshToken, getJwtRefreshSecret()) as any;

    assert.ok(firstRefresh.sid);
    assert.notEqual(secondRefresh.sid, firstRefresh.sid);
    assert.equal(user.activeSessionId, "legacy-device");
    assert.equal(user.save.mock.calls.length, 0);
  });

  it("keeps both devices able to refresh after a second login", async () => {
    const first = await authService.login("user@example.com", "password123");
    const second = await authService.login("user@example.com", "password123");
    for (const device of [first, second, first]) {
      const original = jwt.verify(device.refreshToken, getJwtRefreshSecret()) as any;
      const renewed = await authService.refresh(device.refreshToken);
      const payload = jwt.verify(renewed.accessToken, getJwtAccessSecret()) as any;
      assert.equal(payload.sid, original.sid);
      assert.equal(payload.id, user._id);
    }
  });

  it("still rejects invalid or expired refresh tokens and disabled accounts", async () => {
    const first = await authService.login("user@example.com", "password123");
    const expired = jwt.sign({ id: user._id, sid: "expired" }, getJwtRefreshSecret(), { expiresIn: -1 });
    await assert.rejects(authService.refresh("invalid"));
    await assert.rejects(authService.refresh(expired));
    user.disabledAt = new Date();
    await assert.rejects(authService.refresh(first.refreshToken));
  });
  it("does not send a forced logout event to another device", async () => {
    const socketCalls: Array<{ sessionId: string; eventName: string; data: any }> = [];
    socketModule.setEmitToUserSessionMockForTesting((sessionId, eventName, data) => {
      socketCalls.push({ sessionId, eventName, data });
    });

    await authService.login("user@example.com", "password123");
    assert.deepEqual(socketCalls, []);

    await authService.login("user@example.com", "password123");

    assert.deepEqual(socketCalls, []);
  });
});
