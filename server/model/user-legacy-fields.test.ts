import { afterEach, expect, it, vi } from "vitest";
import { UserModel } from "./user.model";
import { LEGACY_USER_FIELDS } from "../utils/legacy-user-fields";

const oldFields = Object.fromEntries(LEGACY_USER_FIELDS.map((key) => [key, { token: "old-credential" }]));
afterEach(() => vi.restoreAllMocks());
it("does not create or restore retired fields when saving a new profile", () => {
  const user = new UserModel({ email: "member@example.test", displayName: "Member", companyCode: "BNI", role: "user", industry: "IT", ...oldFields });
  const data = user.toObject();
  for (const field of LEGACY_USER_FIELDS) expect(data).not.toHaveProperty(field);
  expect(data).toMatchObject({ role: "user", industry: "IT", companyCode: "BNI" });
});
it("strips retired credentials from existing hydrated documents", () => {
  const user = UserModel.hydrate({ email: "member@example.test", displayName: "Member", permissions: ["chat:read"], ...oldFields });
  for (const field of LEGACY_USER_FIELDS) expect(user.toObject()).not.toHaveProperty(field);
  expect(user.toJSON().permissions).toEqual(["chat:read"]);
});
it("strips retired fields from lean query responses too", async () => {
  vi.spyOn(UserModel.collection, "findOne").mockResolvedValue({ email: "member@example.test", displayName: "Member", ...oldFields });
  const user = await UserModel.findOne({ email: "member@example.test" }).lean();
  for (const field of LEGACY_USER_FIELDS) expect(user).not.toHaveProperty(field);
  expect(user?.displayName).toBe("Member");
});
