import { once } from "node:events";
import http from "node:http";
import express from "express";
import { describe, expect, it, vi } from "vitest";

vi.mock("../middleware/auth", (() => ({
  requireAuth: (req: import("express").Request, _res: import("express").Response, next: import("express").NextFunction) => {
    req.user = { id: "user-1", email: "user@example.com", role: "user", companyCode: "ACME" };
    next();
  },
  requirePermission: (required: string) => (req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) => {
    const granted = String(req.headers["x-permissions"] || "").split(",").filter(Boolean);
    return granted.includes(required) || granted.includes("*")
      ? next()
      : res.status(403).json({ message: "Forbidden" });
  },
}) as unknown as Parameters<typeof vi.mock>[1]));
vi.mock("../controller/analytics.controller", () => ({
  analyticsController: new Proxy({}, { get: () => (_req, res) => res.status(200).json({ ok: true }) }),
}));

const { analyticsRouter } = await import("./analytics.router");

async function withServer(run: (base: string) => Promise<void>) {
  const app = express();
  app.use(express.json());
  app.use("/analytics", analyticsRouter);
  const server = http.createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not start");
  try { await run(`http://127.0.0.1:${address.port}/analytics`); }
  finally { server.close(); await once(server, "close"); }
}

describe("analytics permission behavior", () => {
  it("allows dashboard read users to GET and denies operating-expense mutations", async () => {
    await withServer(async (base) => {
      const list = await fetch(`${base}/meta`, { headers: { "x-permissions": "dashboard:read" } });
      expect(list.status).toBe(200);
      const create = await fetch(`${base}/operating-expenses`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-permissions": "dashboard:read" },
        body: JSON.stringify({ category: "office", description: "supplies", amount: 10, incurredOn: "2026-08-14" }),
      });
      expect(create.status).toBe(403);
    });
  });

  it("allows dashboard manage users to create operating expenses", async () => {
    await withServer(async (base) => {
      const create = await fetch(`${base}/operating-expenses`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-permissions": "dashboard:manage" },
        body: JSON.stringify({ category: "office", description: "supplies", amount: 10, incurredOn: "2026-08-14" }),
      });
      expect(create.status).toBe(200);
    });
  });
});
