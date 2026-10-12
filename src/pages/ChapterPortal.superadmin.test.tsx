// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

test("edits and removes a chapter from the superadmin list", async () => {
  let chapter = { code: "BNI", name: "BNI Chapter", chapterRegion: "Toàn quốc", chapterAddress: "", acceptsApplications: true };
  let archived = false;
  const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
    const method = options?.method || "GET";
    if (url.endsWith("/overview")) return new Response(JSON.stringify({ data: { applications: [], leaves: [] } }), { status: 200 });
    if (method === "PATCH") {
      chapter = { ...chapter, ...JSON.parse(String(options?.body)) };
      return new Response(JSON.stringify({ data: chapter }), { status: 200 });
    }
    if (method === "DELETE") {
      archived = true;
      return new Response(JSON.stringify({ data: chapter }), { status: 200 });
    }
    return new Response(JSON.stringify({ data: archived ? [] : [chapter] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);

  render(<ChapterPortal />);
  fireEvent.click(await screen.findByRole("button", { name: "Sửa Chapter (BNI)" }));
  fireEvent.change(screen.getByLabelText("Tên Chapter"), { target: { value: "Chapter mới" } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
  await waitFor(() => expect(screen.getByRole("heading", { name: "Chapter mới" })).toBeTruthy());
  expect(fetchMock).toHaveBeenCalledWith("/api/v1/chapters/manage/BNI", expect.objectContaining({
    method: "PATCH", body: expect.stringContaining('"name":"Chapter mới"'),
  }));

  fireEvent.click(screen.getByRole("button", { name: "Xóa Chapter mới (BNI)" }));
  expect(screen.getByRole("alertdialog", { name: "Xác nhận xóa Chapter" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Xóa Chapter" }));
  await waitFor(() => expect(screen.queryByRole("heading", { name: "Chapter mới" })).toBeNull());
  expect(fetchMock).toHaveBeenCalledWith("/api/v1/chapters/manage/BNI", expect.objectContaining({ method: "DELETE" }));
});
