import bcrypt from "bcryptjs";
import { expect, it } from "vitest";
import { verifySelfAccountDeletion } from "./self-account-deletion";
const user = { role: "user", password: bcrypt.hashSync("current-password", 4) };
it("requires the current password and the exact confirmation", async () => {
  await expect(verifySelfAccountDeletion(user, "wrong-password", "XÓA TÀI KHOẢN")).rejects.toThrow("Mật khẩu");
  await expect(verifySelfAccountDeletion(user, "current-password", "delete")).rejects.toThrow("xác nhận");
  await expect(verifySelfAccountDeletion(user, "", "XÓA TÀI KHOẢN")).rejects.toThrow("Mật khẩu");
  await expect(verifySelfAccountDeletion(user, "current-password", "XÓA TÀI KHOẢN")).resolves.toBeUndefined();
});
it("allows administrators to verify deletion before the service checks ownership transfer", async () => {
  await expect(verifySelfAccountDeletion({ ...user, role: "admin" }, "current-password", "XÓA TÀI KHOẢN")).resolves.toBeUndefined();
});
it("requires setting a password for passwordless accounts", async () => {
  await expect(verifySelfAccountDeletion({ role: "user" }, "anything", "XÓA TÀI KHOẢN")).rejects.toThrow("thiết lập mật khẩu");
  await expect(verifySelfAccountDeletion(null, "anything", "XÓA TÀI KHOẢN")).rejects.toThrow("Không tìm thấy");
});
