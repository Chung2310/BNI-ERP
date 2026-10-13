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
  expect(screen.getByRole("link", { name: "Lucky Draw Rules" }).getAttribute("href")).toBe("/lucky-draw-rules");
});

test("shows lucky draw rules to a visitor without signing in", async () => {
  window.history.replaceState(null, "", "/lucky-draw-rules");

  render(<App />);

  expect(await screen.findByRole("heading", { name: "Lucky Draw Rules" })).not.toBeNull();
  expect(screen.getByText(/Apple Inc\. is not a sponsor of/)).not.toBeNull();
});
