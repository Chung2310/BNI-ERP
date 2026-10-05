import { beforeEach, afterEach, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
import type { Server } from "http";
import { getJwtAccessSecret } from "./config/env";

const mocks = vi.hoisted(() => ({
  middlewares: [] as Array<(socket: any, next: (error?: Error) => void) => Promise<void>>,
  findUser: vi.fn(),
}));
vi.mock("socket.io", () => ({
  Server: class {
    use(handler: typeof mocks.middlewares[number]) { mocks.middlewares.push(handler); return this; }
    on() { return this; }
  },
}));
vi.mock("ioredis", () => ({
  default: class {
    async connect() { throw new Error("Redis disabled in test"); }
    disconnect() {}
  },
}));
vi.mock("./infrastructure/rate-limit-redis", () => ({
  getRateLimitRedisClient: () => null,
  isRateLimitRedisReady: () => false,
}));
vi.mock("./model/user.model", () => ({
  UserModel: { findById: mocks.findUser, updateMany: vi.fn().mockResolvedValue(undefined) },
}));
import { initSocketServer } from "./socket";

beforeEach(async () => {
  process.env.JWT_ACCESS_SECRET ||= "test-access-secret-at-least-32-characters";
  mocks.middlewares.length = 0;
  mocks.findUser.mockReturnValue({ lean: async () => ({ _id: "user-1", activeSessionId: "other-device" }) });
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  await initSocketServer({} as Server);
});
afterEach(() => vi.restoreAllMocks());

it("allows both devices to establish realtime connections regardless of the last login", async () => {
  for (const sid of ["first-device", "second-device", undefined]) {
    const token = jwt.sign({ id: "user-1", ...(sid ? { sid } : {}) }, getJwtAccessSecret(), { expiresIn: "15m" });
    const socket = { handshake: { auth: { token } }, data: {} as any };
    const next = vi.fn();
    await mocks.middlewares[1](socket, next);
    expect(next).toHaveBeenCalledWith();
    expect(socket.data.user._id).toBe("user-1");
  }
});

it.each(["missing", "invalid", "expired", "deleted"])("rejects %s socket credentials", async scenario => {
  const token = scenario === "missing" ? undefined : scenario === "invalid" ? "bad-token" :
    jwt.sign({ id: "user-1", sid: "device" }, getJwtAccessSecret(), { expiresIn: scenario === "expired" ? -1 : "15m" });
  if (scenario === "deleted") mocks.findUser.mockReturnValue({ lean: async () => null });
  const socket = { handshake: { auth: { token } }, data: {} as any };
  const next = vi.fn();
  await mocks.middlewares[1](socket, next);
  expect(next).toHaveBeenCalledWith(expect.any(Error));
  expect(socket.data.user).toBeUndefined();
});
