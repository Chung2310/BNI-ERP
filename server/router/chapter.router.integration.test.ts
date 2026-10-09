import { afterAll, beforeAll, expect, it } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import express from "express";
import jwt from "jsonwebtoken";
import type { Server } from "node:http";
import { chapterRouter } from "./chapter.router";
import { requireAuth, requirePermission, requireRole } from "../middleware/auth";
import { UserModel } from "../model/user.model";
import { CompanyModel } from "../model/company.model";
import { MembershipApplicationModel } from "../model/membership-application.model";
import { ChapterLeaveRequestModel } from "../model/chapter-leave-request.model";

let database: MongoMemoryServer;
let server: Server;
let baseUrl: string;
const secret = "chapter-test-access-secret-long-enough";

beforeAll(async () => {
  process.env.JWT_ACCESS_SECRET = secret;
  database = await MongoMemoryServer.create();
  await mongoose.connect(database.getUri(), { dbName: "chapter_membership_test" });
  await Promise.all([UserModel.init(), CompanyModel.init(), MembershipApplicationModel.init(), ChapterLeaveRequestModel.init()]);
  const app = express();
  app.use(express.json());
  app.use("/api/v1/chapters", chapterRouter);
  app.get("/api/v1/protected", requireAuth, (_req, res) => res.json({ ok: true }));
  app.get("/api/v1/scoped", requireAuth, requireRole(["admin"]), requirePermission("meetings:read"), (req, res) => res.json({ companyCode: req.user?.companyCode, role: req.user?.role }));
  app.post("/api/v1/scoped", requireAuth, requirePermission("meetings:manage"), (_req, res) => res.json({ changed: true }));
  app.get("/api/v1/auth/users", requireAuth, requirePermission("hr:read"), (req, res) => res.json({ companyCode: req.user?.companyCode }));
  app.get("/api/v1/member-fees", requireAuth, (_req, res) => res.json({ data: [] }));
  app.get("/api/v1/company-email/celebration", requireAuth, (_req, res) => res.json({ data: {} }));
  server = await new Promise<Server>(resolve => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No HTTP port");
  baseUrl = `http://127.0.0.1:${address.port}`;
}, 60_000);

afterAll(async () => {
  if (server) await new Promise<void>(resolve => server.close(() => resolve()));
  await mongoose.disconnect();
  if (database) await database.stop();
});

function token(user: { _id: unknown; email: string; role: string; companyCode?: string }) {
  return jwt.sign({ id: String(user._id), email: user.email, role: user.role, companyCode: user.companyCode }, secret);
}

async function request(path: string, auth: string, method = "GET", body?: unknown) {
  const response = await fetch(`${baseUrl}/api/v1/chapters${path}`, {
    method, headers: { Authorization: `Bearer ${auth}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: await response.json() };
}

it("keeps one editable application, allows confirmation only, and requires confirmation to leave", async () => {
  await CompanyModel.create([
    { code: "CHAPTER_A", name: "Chapter A", ownerEmail: "a@test.vn", isBniChapter: true },
    { code: "CHAPTER_B", name: "Chapter B", ownerEmail: "b@test.vn", isBniChapter: true },
  ]);
  const [adminA, adminB, applicant] = await UserModel.create([
    { email: "admin-a@test.vn", displayName: "Admin A", role: "admin", companyCode: "CHAPTER_A" },
    { email: "admin-b@test.vn", displayName: "Admin B", role: "admin", companyCode: "CHAPTER_B" },
    { email: "applicant@test.vn", displayName: "Applicant", role: "user", phone: "0900000000", companyName: "Business", industry: "Design" },
  ]);
  const applicantToken = token(applicant);
  expect((await fetch(`${baseUrl}/api/v1/protected`, { headers: { Authorization: `Bearer ${applicantToken}` } })).status).toBe(403);
  const first = await request("/me/applications", applicantToken, "POST", { chapterCode: "CHAPTER_A" });
  expect(first.status).toBe(201);
  expect((await request("/me/applications", applicantToken, "POST", { chapterCode: "CHAPTER_B" })).status).toBe(409);
  expect((await request(`/me/applications/${first.body.data._id}`, applicantToken, "PATCH", { chapterCode: "CHAPTER_B" })).status).toBe(200);
  expect((await request("/admin/applications", token(adminA))).body.data).toHaveLength(0);
  expect((await request("/admin/applications", token(adminB))).body.data).toHaveLength(1);
  expect((await request(`/admin/applications/${first.body.data._id}/decision`, token(adminB), "POST", { decision: "rejected" })).status).toBe(400);
  expect((await request(`/me/applications/${first.body.data._id}`, applicantToken, "DELETE")).status).toBe(200);
  const second = await request("/me/applications", applicantToken, "POST", { chapterCode: "CHAPTER_B" });
  expect(second.status).toBe(201);
  expect((await request("/admin/applications", token(adminA))).body.data).toHaveLength(0);
  expect((await request("/admin/applications", token(adminB))).body.data).toHaveLength(1);
  const decision = await request(`/admin/applications/${second.body.data._id}/decision`, token(adminB), "POST", { decision: "approved" });
  expect(decision.status).toBe(200);
  const joined = await UserModel.findById(applicant._id).lean();
  expect(joined?.companyCode).toBe("CHAPTER_B");
  expect((await fetch(`${baseUrl}/api/v1/protected`, { headers: { Authorization: `Bearer ${applicantToken}` } })).status).toBe(200);
  const applications = await MembershipApplicationModel.find({ applicantUserId: applicant._id }).lean();
  expect(applications.map(application => application.status)).toEqual(["approved"]);

  // The original token has no companyCode claim. Authorization still uses the current DB record.
  const leave = await request("/me/leave-requests", applicantToken, "POST", { reason: "Moving" });
  expect(leave.status).toBe(201);
  expect((await UserModel.findById(applicant._id).lean())?.companyCode).toBe(joined?.companyCode);
  const blocked = await request(`/admin/leave-requests/${leave.body.data._id}/decision`, token(adminA), "POST", { decision: "approved" });
  expect(blocked.status).not.toBe(200);
  expect((await request(`/admin/leave-requests/${leave.body.data._id}/decision`, token(adminB), "POST", { decision: "rejected" })).status).toBe(400);
  const approvedLeave = await request(`/admin/leave-requests/${leave.body.data._id}/decision`, token(adminB), "POST", { decision: "approved" });
  expect(approvedLeave.status).toBe(200);
  expect((await UserModel.findById(applicant._id).lean())?.companyCode).toBeUndefined();
  expect((await fetch(`${baseUrl}/api/v1/protected`, { headers: { Authorization: `Bearer ${applicantToken}` } })).status).toBe(403);
  expect((await ChapterLeaveRequestModel.findById(leave.body.data._id).lean())?.status).toBe("approved");
  expect((await request("/me/applications", applicantToken, "POST", { chapterCode: "CHAPTER_A" })).status).toBe(201);
}, 60_000);

it("reserves chapter creation for superadmin and provisions an admin in the new chapter", async () => {
  const admin = await UserModel.findOne({ email: "admin-a@test.vn" }).lean();
  const superadmin = await UserModel.create({ email: "system@test.vn", displayName: "System", role: "superadmin" });
  const body = {
    code: "CHAPTER_C", name: "Chapter C", region: "Hà Nội", address: "Hà Nội",
    adminName: "Admin C", adminEmail: "admin-c@test.vn", adminPassword: "strong-password-123",
  };
  expect((await request("/manage", token(admin!), "POST", body)).status).toBe(403);
  expect((await request("/manage", token(superadmin), "POST", body)).status).toBe(201);
  expect((await CompanyModel.findOne({ code: "CHAPTER_C" }).lean())?.isBniChapter).toBe(true);
  const chapterAdmin = await UserModel.findOne({ email: "admin-c@test.vn" }).lean();
  expect(chapterAdmin?.role).toBe("admin");
  expect(chapterAdmin?.companyCode).toBe("CHAPTER_C");
  const overview = await request("/manage/CHAPTER_C/overview", token(superadmin));
  expect(overview.status).toBe(200);
  expect(overview.body.data.members.map((member: { email: string }) => member.email)).toEqual(["admin-c@test.vn"]);
  expect((await request("/manage/CHAPTER_C/overview", token(admin!))).status).toBe(403);
  const selected = await fetch(`${baseUrl}/api/v1/scoped`, { headers: { Authorization: `Bearer ${token(superadmin)}`, "x-chapter-code": "CHAPTER_C" } });
  expect(selected.status).toBe(200);
  expect(await selected.json()).toEqual({ companyCode: "CHAPTER_C", role: "superadmin" });
  expect((await fetch(`${baseUrl}/api/v1/scoped`, { headers: { Authorization: `Bearer ${token(superadmin)}` } })).status).toBe(403);
  const spoofed = await fetch(`${baseUrl}/api/v1/scoped`, { headers: { Authorization: `Bearer ${token(admin!)}`, "x-chapter-code": "CHAPTER_C" } });
  expect(spoofed.status).toBe(200);
  expect((await spoofed.json()).companyCode).toBe("CHAPTER_A");
  expect((await fetch(`${baseUrl}/api/v1/scoped`, { headers: { Authorization: `Bearer ${token(superadmin)}`, "x-chapter-code": "UNKNOWN" } })).status).toBe(403);
  expect((await fetch(`${baseUrl}/api/v1/scoped`, { method: "POST", headers: { Authorization: `Bearer ${token(superadmin)}`, "x-chapter-code": "CHAPTER_C" } })).status).toBe(403);
  const chapterHeaders = { Authorization: `Bearer ${token(superadmin)}`, "x-chapter-code": "CHAPTER_C" };
  const roster = await fetch(`${baseUrl}/api/v1/auth/users`, { headers: chapterHeaders });
  expect(roster.status).toBe(200);
  expect((await roster.json()).companyCode).toBe("CHAPTER_C");
  expect((await fetch(`${baseUrl}/api/v1/member-fees`, { headers: chapterHeaders })).status).toBe(403);
  expect((await fetch(`${baseUrl}/api/v1/company-email/celebration`, { headers: chapterHeaders })).status).toBe(403);
  expect((await request("/manage/CHAPTER_C", token(superadmin), "PATCH", { name: "Renamed" })).status).toBe(403);
  expect((await request("/manage/CHAPTER_C", token(superadmin), "DELETE")).status).toBe(403);
  expect((await CompanyModel.findOne({ code: "CHAPTER_C" }).lean())?.name).toBe("Chapter C");
}, 60_000);
