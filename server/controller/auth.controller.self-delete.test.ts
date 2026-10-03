import { beforeEach, expect, it, vi } from "vitest";
const deps = vi.hoisted(() => ({ deleteOwnAccount: vi.fn(), getMe: vi.fn(), updateProfile: vi.fn(), findCompany: vi.fn(), permissions: vi.fn(), finalizeCover: vi.fn() }));
vi.mock("../service/auth.service", () => ({ authService: { deleteOwnAccount: deps.deleteOwnAccount, getMe: deps.getMe, updateProfile: deps.updateProfile } }));
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

beforeEach(() => vi.clearAllMocks());
it("uses only the session account id and clears the refresh cookie after success", async () => {
  deps.deleteOwnAccount.mockResolvedValue(undefined);
  const res: any = { status: vi.fn(), json: vi.fn(), clearCookie: vi.fn() };
  res.status.mockReturnValue(res);
  await authController.deleteOwnAccount({ user: { id: "me" }, body: { id: "another-user", password: "password", confirmation: "XÓA TÀI KHOẢN" } } as any, res);
  expect(deps.deleteOwnAccount).toHaveBeenCalledWith("me", "password", "XÓA TÀI KHOẢN");
  expect(res.clearCookie).toHaveBeenCalledWith("refreshToken", expect.objectContaining({ httpOnly: true, sameSite: "strict" }));
  expect(res.status).toHaveBeenCalledWith(200);
});
it("requires authentication and keeps the session cookie when verification fails", async () => {
  const res: any = { status: vi.fn(), json: vi.fn(), clearCookie: vi.fn() };
  res.status.mockReturnValue(res);
  await authController.deleteOwnAccount({ body: {} } as any, res);
  expect(res.status).toHaveBeenCalledWith(401);
  expect(deps.deleteOwnAccount).not.toHaveBeenCalled();
  deps.deleteOwnAccount.mockRejectedValue(new Error("Invalid password"));
  await authController.deleteOwnAccount({ user: { id: "me" }, body: { password: "wrong", confirmation: "XÓA TÀI KHOẢN" } } as any, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.clearCookie).not.toHaveBeenCalled();
});