// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";

const originalFetch = window.fetch;

afterEach(() => {
  window.fetch = originalFetch;
  vi.resetModules();
});

it("returns public QR check-in credential errors without refreshing the session", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(
    JSON.stringify({ message: "Tài khoản hoặc mật khẩu không đúng với thành viên của đơn vị tổ chức." }),
    { status: 401, headers: { "Content-Type": "application/json" } },
  ));
  window.fetch = fetchMock;
  await import("./apiInterceptor");

  const response = await window.fetch("/api/v1/meeting-checkin/qr-token/member", { method: "POST" });

  expect(response.status).toBe(401);
  expect((await response.json()).message).toContain("mật khẩu không đúng");
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
