// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

vi.mock("./context/AuthContext", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useAuth: () => ({ user: null, userProfile: null, loading: false }),
}));
vi.mock("./pages/LandingPage", () => ({ default: () => <div>Landing Page Content</div> }));

import App from "./App";

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

test.each(["/", "/landing", "/landing.html", "/dang-nhap"])("renders login for guests at %s", async (path) => {
  window.history.replaceState(null, "", path);

  render(<App />);

  expect(await screen.findByRole("button", { name: "Đăng nhập hệ thống" })).not.toBeNull();
  expect(screen.queryByText("Landing Page Content")).toBeNull();
  expect(screen.getByRole("link", { name: "Privacy Policy" }).getAttribute("href")).toBe("/privacy-policy");
  expect(screen.getByRole("link", { name: "Terms of Service" }).getAttribute("href")).toBe("/terms-of-service");
  expect(screen.getByRole("link", { name: "Data Deletion" }).getAttribute("href")).toBe("/user-data-deletion");
  expect(screen.getByRole("link", { name: "Wheel Selection Guide" }).getAttribute("href")).toBe("/lucky-draw-rules");
});

test("shows the name selection guide to a visitor without signing in", async () => {
  window.history.replaceState(null, "", "/lucky-draw-rules");

  render(<App />);

  expect(await screen.findByRole("heading", { name: "Hướng dẫn vòng quay may mắn" })).not.toBeNull();
  expect(screen.getByText(/^Vòng quay may mắn hỗ trợ người điều phối chọn ngẫu nhiên một người/)).not.toBeNull();
});

test.each(["/privacy-policy", "/privacy-policy.html"])("makes privacy information and contact links available without an account at %s", async (path) => {
  window.history.replaceState(null, "", path);
  render(<App />);

  expect(await screen.findByRole("heading", { name: "Chính sách bảo mật", level: 1 })).not.toBeNull();
  expect(screen.getByRole("heading", { name: "3. Vị trí và check-in" })).not.toBeNull();
  expect(screen.getByRole("heading", { name: "5. Face ID và sinh trắc học" })).not.toBeNull();
  expect(screen.getByRole("heading", { name: "9. Lưu trữ và xóa dữ liệu" })).not.toBeNull();
  expect(screen.getByText(/tự động xóa hồ sơ, ảnh cá nhân, tin nhắn/)).not.toBeNull();
  expect(screen.getByRole("link", { name: /Hỗ trợ quyền riêng tư:/ }).getAttribute("href")).toBe("mailto:igen.work99@gmail.com");
  expect(screen.queryByRole("button", { name: "Đăng nhập hệ thống" })).toBeNull();
});
