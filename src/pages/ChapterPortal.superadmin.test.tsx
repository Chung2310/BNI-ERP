// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import ChapterPortal from "./ChapterPortal";

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    userProfile: { role: "superadmin", companyCode: "" },
    superadminActiveChapter: "BNI",
    setSuperadminActiveChapter: vi.fn(),
    refreshProfile: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("shows the legacy BNI chapter as Chapter while keeping its code", async () => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(JSON.stringify({
    data: url.endsWith("/overview")
      ? { applications: [], leaves: [] }
      : [{ code: "BNI", name: "BNI Chapter", chapterRegion: "Toàn quốc" }],
  }), { status: 200 })));

  render(<ChapterPortal />);

  expect(await screen.findByRole("heading", { name: "Chapter" })).toBeTruthy();
  expect(screen.getByText("BNI")).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Đơn gia nhập chờ xác nhận · Chapter" })).toBeTruthy();
  expect(screen.getByText("Chapter hiện không có đơn xin gia nhập nào đang chờ duyệt.")).toBeTruthy();
  expect(screen.queryByText(/BNI Chapter|Chapter BNI/)).toBeNull();
});
