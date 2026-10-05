import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ findCompany: vi.fn(), accessToken: vi.fn(), createFolder: vi.fn(), credentials: vi.fn() }));
vi.mock("../model/company.model", () => ({ CompanyModel: { findOne: mocks.findCompany } }));
vi.mock("./google-oauth.service", () => ({ googleOAuthService: { getAccessToken: mocks.accessToken } }));
vi.mock("./google-drive.service", () => ({ googleDriveService: { createFolder: mocks.createFolder } }));
vi.mock("googleapis", () => ({ google: { auth: { OAuth2: class { setCredentials = mocks.credentials; } } } }));
import { getCompanyDriveContext } from "./company-drive-context.service";
beforeEach(() => vi.clearAllMocks());
it("reports disconnected without a company OAuth connection", async () => {
  mocks.findCompany.mockResolvedValue({ code: "BNI" });
  expect(await getCompanyDriveContext("bni")).toMatchObject({ authClient: null, isConnected: false, rootFolderId: "" });
  expect(mocks.accessToken).not.toHaveBeenCalled();
});
it("uses the company connection and existing resource root", async () => {
  mocks.findCompany.mockResolvedValue({ code: "BNI", driveFolderId: "company-root", driveOAuth: { refreshToken: "company-refresh", connectedEmail: "drive@example.test" } });
  mocks.accessToken.mockResolvedValue("company-access");
  expect(await getCompanyDriveContext("bni")).toMatchObject({ isConnected: true, rootFolderId: "company-root", email: "drive@example.test" });
  expect(mocks.findCompany).toHaveBeenCalledWith({ code: "BNI" });
  expect(mocks.accessToken).toHaveBeenCalledWith("company-refresh");
  expect(mocks.createFolder).not.toHaveBeenCalled();
});
it("creates a company root once when no folder is configured", async () => {
  const company = { code: "BNI", name: "Chapter", driveFolderId: "", driveFolderLink: "", driveOAuth: { refreshToken: "company-refresh" }, save: vi.fn() };
  mocks.findCompany.mockResolvedValue(company);
  mocks.accessToken.mockResolvedValue("company-access");
  mocks.createFolder.mockResolvedValue({ id: "new-root", webViewLink: "https://drive.google.com/new-root" });
  expect((await getCompanyDriveContext("BNI")).rootFolderId).toBe("new-root");
  expect(company.save).toHaveBeenCalledOnce();
});
