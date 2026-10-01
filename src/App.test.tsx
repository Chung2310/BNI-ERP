// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

vi.mock("./context/AuthContext", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useAuth: () => ({ user: null, userProfile: null, loading: false }),
}));
vi.mock("./pages/LandingPage", () => ({ default: () => <div>Landing Page Content</div> }));

import App from "./App";

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

test("renders landing page for guest users", async () => {
  window.history.replaceState(null, "", "/");

  render(<App />);

  expect(await screen.findByText("Landing Page Content")).not.toBeNull();
});
