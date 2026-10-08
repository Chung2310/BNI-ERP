import express from "express";
import type { Server } from "node:http";
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
vi.mock("../../socket", () => ({ emitToCompany: vi.fn() }));
vi.mock("../../middleware/auth", () => ({
  requireAuth: (req: import('express').Request, _res: import('express').Response, next: import('express').NextFunction) => { req.user = { id: "organizer", email: "organizer@test.invalid", companyCode: String(req.headers["x-company"] || "BNI"), role: String(req.headers["x-role"] || "admin") }; next(); },
  requirePermission: (permissions: string[]) => (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) =>
    req.user.role === "admin" || (req.user.role === "member" && permissions.includes("meetings:read")) ? next() : res.sendStatus(403),
  getEffectivePermissions: vi.fn(), hasAnyPermission: vi.fn(),
}));
import { MeetingModel } from "./meeting.model";
import { meetingRouter } from "./meeting.router";
const id = "507f1f77bcf86cd799439011";
let server: Server; let base: string;
beforeAll(async () => {
  const app = express(); app.use(express.json()); app.use("/meetings", meetingRouter);
  server = await new Promise<Server>(resolve => { const instance = app.listen(0, "127.0.0.1", () => resolve(instance)); });
  base = "http://127.0.0.1:" + (server.address() as import('node:net').AddressInfo).port + "/meetings/" + id;
});
afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });
afterEach(() => vi.restoreAllMocks());
function seed() {
  const item = MeetingModel.hydrate({ _id: id, companyCode: "BNI", title: "Demo", speakers: [], __v: 2 });
  item.save = vi.fn(async () => item) as unknown as typeof item.save;
  const find = vi.spyOn(MeetingModel, "findOne").mockImplementation((query) => Promise.resolve((query as unknown as { companyCode?: string }).companyCode === "BNI" ? item : null) as unknown as ReturnType<typeof MeetingModel.findOne>);
  return { item, find };
}
it("returns a read-only snapshot with server time and no cache", async () => {
  const { item, find } = seed();
  const response = await fetch(base + "/live");
  const data = await response.json();
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(data.data).toMatchObject({ meeting: { _id: id, __v: 2 }, slides: [] });
  expect(data.data.serverNow).toBeGreaterThan(Date.now() - 10000);
  expect(find).toHaveBeenCalledWith({ _id: id, companyCode: "BNI" });
  expect(item.save).not.toHaveBeenCalled();
});
it("returns a lightweight live state without rebuilding profile slides", async () => {
  const { find } = seed();
  const response = await fetch(base + "/live/state");
  const data = await response.json();
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(data.data).toMatchObject({ meeting: { _id: id, __v: 2 } });
  expect(data.data).not.toHaveProperty("slides");
  expect(find).toHaveBeenCalledWith({ _id: id, companyCode: "BNI" });
});
it("lets a member read presentation data and expires an abandoned display", async () => {
  const { item, find } = seed();
  const now = Date.now();
  item.set("presentationDisplayHeartbeatAt", new Date(now - 31_000));
  const stale = await fetch(base + "/presentation-display", { headers: { "x-role": "member" } });
  expect(stale.status).toBe(200);
  expect(stale.headers.get("cache-control")).toBe("no-store");
  expect((await stale.json()).data).toMatchObject({ meetingId: id, isOpen: false, slides: [], version: 2 });
  item.set("presentationDisplayHeartbeatAt", new Date());
  const active = await (await fetch(base + "/presentation-display", { headers: { "x-role": "member" } })).json();
  expect(active.data.isOpen).toBe(true);
  const otherCompany = await fetch(base + "/presentation-display", { headers: { "x-role": "member", "x-company": "OTHER" } });
  expect(otherCompany.status).toBe(404);
  expect(find).toHaveBeenCalledWith({ _id: id, companyCode: "OTHER" });
  expect(item.save).not.toHaveBeenCalled();
});
it("accepts display heartbeats only from organizers in the same company", async () => {
  const { item } = seed();
  const update = vi.spyOn(MeetingModel, "findOneAndUpdate").mockImplementation((query, change) => {
    if ((query as { companyCode?: string }).companyCode !== "BNI") return Promise.resolve(null) as ReturnType<typeof MeetingModel.findOneAndUpdate>;
    item.set("presentationDisplayHeartbeatAt", (change as { $set: { presentationDisplayHeartbeatAt: Date } }).$set.presentationDisplayHeartbeatAt);
    return Promise.resolve(item) as ReturnType<typeof MeetingModel.findOneAndUpdate>;
  });
  expect((await fetch(base + "/presentation-display/heartbeat", { method: "POST", headers: { "x-role": "member" } })).status).toBe(403);
  expect((await fetch(base + "/presentation-display/heartbeat", { method: "POST", headers: { "x-company": "OTHER" } })).status).toBe(404);
  const response = await fetch(base + "/presentation-display/heartbeat", { method: "POST" });
  expect(response.status).toBe(200);
  expect((await response.json()).data.isOpen).toBe(true);
  expect(update).toHaveBeenCalledWith({ _id: id, companyCode: "BNI" }, expect.objectContaining({ $set: { presentationDisplayHeartbeatAt: expect.any(Date) } }), expect.any(Object));
  expect(item.__v).toBe(2);
  expect(item.save).not.toHaveBeenCalled();
});
it("scopes both reads and control changes to the authenticated company", async () => {
  const { item } = seed();
  for (const path of ["/live", "/presentation-state"]) {
    const response = await fetch(base + path, { method: path === "/live" ? "GET" : "PATCH",
      headers: { "x-company": "OTHER", "Content-Type": "application/json" },
      ...(path === "/live" ? {} : { body: JSON.stringify({ version: 2, view: "speaker" }) }) });
    expect(response.status).toBe(404);
  }
  expect(item.save).not.toHaveBeenCalled();
});
it.each([["/live", "GET"], ["/live/state", "GET"], ["/presentation-state", "PATCH"], ["/presentation-draw", "POST"]])("requires organizer permission for %s", async (path, method) => {
  const { find } = seed();
  const response = await fetch(base + path, { method, headers: { "x-role": "member" } });
  expect(response.status).toBe(403); expect(find).not.toHaveBeenCalled();
});
it("rejects stale commands without mutating the shared state", async () => {
  const { item } = seed();
  const response = await fetch(base + "/presentation-state", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: 1, view: "speaker" }) });
  expect(response.status).toBe(409); expect(item.presentation?.view).toBe("checkin"); expect(item.save).not.toHaveBeenCalled();
});
it("applies a view change from the controller to the next display snapshot", async () => {
  const { item } = seed();
  const response = await fetch(base + "/presentation-state", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: 2, view: "activeMembers" }) });
  expect(response.status).toBe(200); expect(item.save).toHaveBeenCalledTimes(1);
  const display = await (await fetch(base + "/live")).json();
  expect(display.data.meeting.presentation.view).toBe("activeMembers");
});
it("rejects a second draw until the first result is revealed", async () => {
  const { item } = seed(); item.set("presentation.drawRevealsAt", new Date(Date.now() + 5000));
  const response = await fetch(base + "/presentation-draw", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: 2, prizeId: "prize" }) });
  expect(response.status).toBe(409); expect(item.save).not.toHaveBeenCalled();
});
