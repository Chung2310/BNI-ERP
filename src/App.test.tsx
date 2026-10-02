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
  expect(screen.getByRole("link", { name: "Privacy Policy" }).getAttribute("href")).toBe("https://erp.igentechnology.net/privacy-policy");
  expect(screen.getByRole("link", { name: "Terms of Service" }).getAttribute("href")).toBe("https://erp.igentechnology.net/terms-of-service");
  expect(screen.getByRole("link", { name: "Data Deletion" }).getAttribute("href")).toBe("https://erp.igentechnology.net/user-data-deletion");
});
