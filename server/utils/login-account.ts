import { UserModel } from "../model/user.model";
import { normalizeLoginIdentifier } from "../../src/utils/loginIdentifier";

export async function findLoginAccount(identifier: unknown) {
  const normalized = normalizeLoginIdentifier(identifier);
  if (!normalized) return null;
  if (normalized.includes("@")) return UserModel.findOne({ email: normalized });
  const alternatives = /^0\d{9,10}$/.test(normalized)
    ? [normalized, "84" + normalized.slice(1), "+84" + normalized.slice(1)] : [normalized];
  // Match existing formatted phone values without rewriting member profiles.
  const separator = "[\\s().-]*";
  const patterns = alternatives.map(value => [...value].map(char => char === "+" ? "\\+" : char).join(separator));
  const phone = new RegExp("^" + separator + "(?:" + patterns.join("|") + ")" + separator + "$");
  const users = await UserModel.find({ phone }).limit(2);
  if (users.length > 1) throw new Error("Số điện thoại được dùng cho nhiều tài khoản. Vui lòng đăng nhập bằng email.");
  return users[0] || null;
}
