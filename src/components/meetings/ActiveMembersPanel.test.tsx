// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { ActiveMembersPanel } from "./ActiveMembersPanel";
import { authService } from "../../services/authService";
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ userProfile: { companyCode: "ACME" } }) }));
vi.mock("../../services/authService", () => ({ authService: { getUsersByCompany: vi.fn(), getColleagues: vi.fn() } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it("excludes admins and inactive accounts from the meeting flow ranking and its check-in history", async () => {
  vi.mocked(authService.getUsersByCompany).mockResolvedValue([
    { uid: "admin", role: "admin", displayName: "Admin Account" },
    { uid: "inactive", role: "user", isActive: false, displayName: "Inactive Member" },
    { uid: "member", role: "user", displayName: "Active Member" },
  ] as any);
  const meeting = {
    _id: "meeting", status: "live", startsAt: "2026-10-01T01:00:00Z",
    speakers: [
      { id: "a", userId: "admin", name: "Historical Admin" },
      { id: "b", userId: "inactive", name: "Historical Inactive" },
      { id: "c", userId: "unknown", name: "Unlisted Account" },
      { id: "d", userId: "member", name: "Active Member" },
    ],
  };
  render(<ActiveMembersPanel meeting={meeting} meetings={[meeting]} />);
  expect(await screen.findAllByText("Active Member")).toHaveLength(2);
  expect(screen.queryByText(/Admin|Inactive|Unlisted/)).toBeNull();
  await waitFor(() => expect(authService.getUsersByCompany).toHaveBeenCalledWith("ACME"));
});
