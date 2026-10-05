import bcrypt from "bcryptjs";
import assert from "node:assert/strict";
import test from "node:test";
import { CompanyModel } from "../model/company.model";
import { UserModel } from "../model/user.model";
import { authService } from "./auth.service";

test("login allows a legacy company without lifecycleStatus", async () => {
  const originalFindUser = UserModel.findOne;
  const originalFindCompany = CompanyModel.findOne;

  process.env.JWT_ACCESS_SECRET ||= "test-access-secret-at-least-32-characters";
  process.env.JWT_REFRESH_SECRET ||= "test-refresh-secret-at-least-32-characters";

  UserModel.findOne = (() => Promise.resolve({
    _id: "legacy-user-id",
    email: "legacy@example.com",
    password: bcrypt.hashSync("password123", 4),
    role: "user",
    companyCode: "LEGACY",
    save: async function () { return this; },
  })) as typeof UserModel.findOne;

  CompanyModel.findOne = (() => ({
    select: () => ({
      lean: () => Promise.resolve({}),
    }),
  })) as unknown as typeof CompanyModel.findOne;

  try {
    const result = await authService.login("legacy@example.com", "password123");
    assert.equal(result.kind, "authenticated");
  } finally {
    UserModel.findOne = originalFindUser;
    CompanyModel.findOne = originalFindCompany;
  }
});

test("register-company persists general business type and core modules", async () => {
  const originalCompanyFindOne = CompanyModel.findOne;
  const originalCompanySave = CompanyModel.prototype.save;
  const originalUserFindOne = UserModel.findOne;
  const originalUserSave = UserModel.prototype.save;
  let savedCompany: any;

  (CompanyModel).findOne = async () => null;
  (CompanyModel.prototype).save = async function () {
    savedCompany = this;
    return this;
  };
  (UserModel).findOne = async () => null;
  (UserModel.prototype).save = async function () { return this; };

  try {
    await authService.registerCompanyAndAdmin({
      companyName: "Acme Corp",
      companyCode: "acme",
      ownerName: "Owner",
      ownerEmail: "owner@acme.test",
      ownerPassword: "password",
      businessType: "general",
      enabledModules: ["hr", "resource", "chat"],
    });
    assert.equal(savedCompany.businessType, "general");
    assert.deepEqual(savedCompany.enabledModules, ["hr", "resource", "chat"]);
  } finally {
    CompanyModel.findOne = originalCompanyFindOne;
    CompanyModel.prototype.save = originalCompanySave;
    UserModel.findOne = originalUserFindOne;
    UserModel.prototype.save = originalUserSave;
  }
});
