import { beforeEach, expect, it, vi } from "vitest";
const deps = vi.hoisted(() => ({ getMe: vi.fn(), updateProfile: vi.fn(), findCompany: vi.fn(), permissions: vi.fn(), finalizeCover: vi.fn() }));
vi.mock("../service/auth.service", () => ({ authService: { getMe: deps.getMe, updateProfile: deps.updateProfile } }));
vi.mock("../model/user.model", () => ({ UserModel: {} }));
vi.mock("../model/company.model", () => ({ CompanyModel: { findOne: deps.findCompany } }));
vi.mock("../middleware/auth", () => ({ getEffectivePermissions: deps.permissions }));
vi.mock("../service/google-oauth.service", () => ({ googleOAuthService: {} }));
vi.mock("../middleware/user-activity", () => ({ recordUserActivity: vi.fn() }));
vi.mock("../middleware/require-module", () => ({ clearModuleCache: vi.fn() }));
vi.mock("../service/company-module-notify", () => ({ notifyCompanyModulesChanged: vi.fn() }));
vi.mock("../service/profile-resource.service", () => ({ profileResourceService: { finalizeCover: deps.finalizeCover } }));
vi.mock("../service/employee-document-resource.service", () => ({ employeeDocumentResourceService: {} }));
vi.mock("../service/resource-indexing.service", () => ({ resourceIndexingService: {} }));
import { authController } from "./auth.controller";
import { PERMISSION_CODES } from "../config/permission-catalog";

let storedUser: Record<string, unknown>;
function response() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}
beforeEach(() => {
  vi.clearAllMocks();
  storedUser = { _id: "member-1", role: "user", companyCode: "BNI", displayName: "Member", permissions: [] };
  deps.getMe.mockResolvedValue({ toObject: () => ({ ...storedUser }) });
  deps.updateProfile.mockResolvedValue({ toObject: () => ({ ...storedUser }) });
  deps.findCompany.mockReturnValue({ select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue({ enabledModules: ["hr", "chat"], businessType: "general" }) }) });
  deps.permissions.mockResolvedValue(new Set(["hr:read", "chat:read"]));
});

it.each([{ displayName: "New name" }, { photoURL: "/new-avatar.png" }])("returns the same access rights as GET /me after updating %j", async (body) => {
  const getRes = response();
  const updateRes = response();
  const req = { user: { id: "member-1" }, body } as any;
  await authController.getMe(req, getRes as any);
  await authController.updateProfile(req, updateRes as any);
  expect(updateRes.status).toHaveBeenCalledWith(200);
  const updated = updateRes.json.mock.calls[0][0].user;
  expect(updated.permissions).toEqual(["hr:read", "chat:read"]);
  expect(updated.enabledModules).toEqual(["hr", "chat"]);
  expect(updated.businessType).toBe("general");
  expect(updated).toEqual(getRes.json.mock.calls[0][0].user);
  expect(deps.permissions).toHaveBeenCalledWith("member-1", "user", "BNI");
});

it("returns full resolved permissions for an admin after saving", async () => {
  storedUser.role = "admin";
  const res = response();
  await authController.updateProfile({ user: { id: "member-1" }, body: {} } as any, res as any);
  expect(res.json.mock.calls[0][0].user.permissions).toEqual(PERMISSION_CODES);
});

it("keeps a legitimately empty effective permission set empty", async () => {
  storedUser.permissions = ["hr:read"];
  deps.permissions.mockResolvedValue(new Set());
  const res = response();
  await authController.updateProfile({ user: { id: "member-1" }, body: {} } as any, res as any);
  expect(res.json.mock.calls[0][0].user.permissions).toEqual([]);
});

it("finalizes cover uploads for the authenticated member without losing access rights", async () => {
  const res = response();
  const body = { coverImage: "/new-cover.png", coverUploadToken: "cover-token" };
  await authController.updateProfile({ user: { id: "member-1" }, body } as any, res as any);
  expect(deps.updateProfile).toHaveBeenCalledWith("member-1", body);
  expect(deps.finalizeCover).toHaveBeenCalledWith(expect.objectContaining({ actorId: "member-1", companyCode: "BNI" }), expect.objectContaining({ _id: "member-1" }), "cover-token");
  expect(res.json.mock.calls[0][0].user.permissions).toEqual(["hr:read", "chat:read"]);
});
