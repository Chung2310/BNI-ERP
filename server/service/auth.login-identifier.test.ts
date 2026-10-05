import bcrypt from "bcryptjs";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { UserModel } from "../model/user.model";
import { CompanyModel } from "../model/company.model";
import { authService } from "./auth.service";
import { findLoginAccount } from "../utils/login-account";
import { resolveLoginAccountKey } from "../middleware/rate-limit-key";
import { loginSchema } from "../router/auth.router";
const user = () => ({ _id: "member-1", email: "member@example.com", phone: "0901234567", role: "user", companyCode: "SYSTEM", password: bcrypt.hashSync(" pass123 ", 4), save: vi.fn().mockResolvedValue(undefined) });
beforeEach(() => {
 process.env.JWT_ACCESS_SECRET ||= "test-access-secret-at-least-32-characters";
 process.env.JWT_REFRESH_SECRET ||= "test-refresh-secret-at-least-32-characters";
});
afterEach(() => vi.restoreAllMocks());
it.each(["0901234567", "+84 901 234 567", "0901.234.567"])("logs in by phone %s using the existing password", async identifier => {
 const member = user();
 const find = vi.spyOn(UserModel, "find").mockReturnValue(({ limit: vi.fn().mockResolvedValue([member]) } as unknown as Parameters<((value: ReturnType<typeof UserModel.find>) => void)>[0]));
 const result = await authService.login(identifier, " pass123 ");
 expect(result.user).toBe(member);
 expect(result.accessToken).toBeTruthy();
 const phone = (find.mock.calls[0][0] as unknown as { phone: RegExp }).phone;
 for (const stored of ["0901234567", "0901 234 567", "+84 (901) 234-567", "84901234567"]) expect(phone.test(stored)).toBe(true);
 expect(phone.test("10901234567")).toBe(false);
});
it("still resolves email case-insensitively", async () => {
 const find = vi.spyOn(UserModel, "findOne").mockResolvedValue((user() as unknown as Parameters<((value: Awaited<ReturnType<typeof UserModel.findOne>>) => void)>[0]));
 await authService.login(" MEMBER@EXAMPLE.COM ", " pass123 ");
 expect(find).toHaveBeenCalledWith({ email: "member@example.com" });
});
it("rejects ambiguous phones without choosing either account", async () => {
 vi.spyOn(UserModel, "find").mockReturnValue(({ limit: vi.fn().mockResolvedValue([user(), user()]) } as unknown as Parameters<((value: ReturnType<typeof UserModel.find>) => void)>[0]));
 await expect(authService.login("0901234567", " pass123 ")).rejects.toThrow(/email/);
});
it("rejects unknown numbers, wrong passwords and accounts without passwords", async () => {
 vi.spyOn(UserModel, "find").mockReturnValue(({ limit: vi.fn().mockResolvedValue([]) } as unknown as Parameters<((value: ReturnType<typeof UserModel.find>) => void)>[0]));
 await expect(authService.login("0901234567", " pass123 ")).rejects.toThrow();
 const member = user(); const find = vi.spyOn(UserModel, "findOne").mockResolvedValue((member as unknown as Parameters<((value: Awaited<ReturnType<typeof UserModel.findOne>>) => void)>[0]));
 await expect(authService.login(member.email, "wrong")).rejects.toThrow();
 find.mockResolvedValue(({ ...member, password: undefined } as unknown as Parameters<typeof find.mockResolvedValue>[0]));
 await expect(authService.login(member.email, "anything")).rejects.toThrow();
 expect(member.save).not.toHaveBeenCalled();
});
it("preserves disabled-account and company checks for phone login", async () => {
 const member = { ...user(), disabledAt: new Date() };
 const limit = vi.fn().mockResolvedValue([member]);
 vi.spyOn(UserModel, "find").mockReturnValue(({ limit } as unknown as Parameters<((value: ReturnType<typeof UserModel.find>) => void)>[0]));
 await expect(authService.login(member.phone, " pass123 ")).rejects.toThrow(/vô hiệu/);
 limit.mockResolvedValue([{ ...user(), companyCode: "BNI" }]);
 vi.spyOn(CompanyModel, "findOne").mockReturnValue(({ select: () => ({ lean: async () => ({ lifecycleStatus: "suspended" }) }) } as unknown as Parameters<((value: ReturnType<typeof CompanyModel.findOne>) => void)>[0]));
 await expect(authService.login(member.phone, " pass123 ")).rejects.toThrow(/tạm ngưng/);
});
it("rejects malformed identifiers before querying storage", async () => {
 const find = vi.spyOn(UserModel, "find");
 expect(await findLoginAccount({ $ne: null })).toBeNull();
 expect(await findLoginAccount("090.*")).toBeNull();
 expect(find).not.toHaveBeenCalled();
});
it("uses one rate-limit key for equivalent phone formats", () => {
 const key = (identifier: string) => resolveLoginAccountKey(({ body: { identifier } } as unknown as Parameters<typeof resolveLoginAccountKey>[0]));
 expect(key("0901234567")).toBe(key("+84 901.234.567"));
 expect(key(" MEMBER@EXAMPLE.COM ")).toBe("acct:member@example.com");
});
it("accepts the new identifier and legacy email payloads, rejecting ambiguous or invalid requests", () => {
 for (const body of [{ identifier: "0901234567", password: "123456" }, { identifier: "member@example.com", password: "123456" }, { email: "member@example.com", password: "123456" }]) expect(loginSchema.body.validate(body).error).toBeUndefined();
 for (const body of [{ identifier: "bad", password: "123456" }, { identifier: "0901234567" }, { password: "123456" }, { identifier: "0901234567", email: "member@example.com", password: "123456" }]) expect(loginSchema.body.validate(body).error).toBeDefined();
});
