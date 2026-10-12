// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { authService } from "./authService";

afterEach(() => vi.unstubAllGlobals());

test("getColleagues excludes inactive users", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: [
    { _id: "active-tech", displayName: "Active technician", isActive: true },
    { _id: "inactive-tech", displayName: "Inactive technician", isActive: false },
  ] }), { status: 200 })));

  await expect(authService.getColleagues()).resolves.toEqual([
    expect.objectContaining({ uid: "active-tech", isActive: true }),
  ]);
});

test("registration shows the phone validation detail returned by the API", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
    message: "Dữ liệu yêu cầu không hợp lệ",
    errors: { body: ["Số điện thoại Việt Nam không đúng định dạng (ví dụ: 0987654321)."] },
  }), { status: 400 })));

  await expect(authService.registerWithEmail("person@example.com", "password123", "Person", {
    phone: "0123456789", companyName: "Company", industry: "Sales",
  })).rejects.toThrow("Số điện thoại Việt Nam không đúng định dạng (ví dụ: 0987654321).");
});
