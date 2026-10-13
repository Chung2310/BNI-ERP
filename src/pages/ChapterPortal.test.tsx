// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ChapterPortal from "./ChapterPortal";

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ userProfile: { role: "user", companyCode: "" }, refreshProfile: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("shows the chapter directory and filters it by search and province", async () => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(JSON.stringify({ data:
    url.endsWith("/me/applications") ? [] : [
      { code: "HN_A", name: "Chapter Hà Nội", chapterRegion: "Hà Nội", chapterAddress: "Ba Đình", chairpersonName: "Nguyễn A" },
      { code: "HCM_B", name: "Chapter Sài Gòn", chapterRegion: "TP Hồ Chí Minh", chapterAddress: "Quận 1", chairpersonName: "Trần B" },
    ],
  }), { status: 200 })));

  render(<ChapterPortal />);
  expect(await screen.findByText("Chapter Hà Nội")).toBeTruthy();
  expect(screen.getByText("Chủ tịch: Nguyễn A")).toBeTruthy();
  expect(screen.getByText("HN_A")).toBeTruthy();
  expect(screen.getByText("Ba Đình, Hà Nội")).toBeTruthy();

  fireEvent.change(screen.getByLabelText("Tỉnh / Thành phố"), { target: { value: "Hà Nội" } });
  expect(screen.queryByText("Chapter Sài Gòn")).toBeNull();
  fireEvent.change(screen.getByLabelText("Tỉnh / Thành phố"), { target: { value: "" } });
  fireEvent.change(screen.getByPlaceholderText("Tên, mã, địa điểm hoặc chủ tịch..."), { target: { value: "tran b" } });
  await waitFor(() => expect(screen.getByText("Chapter Sài Gòn")).toBeTruthy());
  expect(screen.queryByText("Chapter Hà Nội")).toBeNull();
});

test("shows chapter statistics and submits an application using only the chapter code", async () => {
  let pending = false;
  const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
    if (url.endsWith("/directory/HN_A")) return new Response(JSON.stringify({ data: {
      code: "HN_A", name: "Chapter Hà Nội", chapterRegion: "Hà Nội", chapterAddress: "Ba Đình",
      chairpersonName: "Nguyễn A", memberCount: 26, completedMeetingCount: 12,
    } }), { status: 200 });
    if (options?.method === "POST") {
      pending = true;
      return new Response(JSON.stringify({ data: { _id: "application-1", chapterCode: "HN_A", status: "pending" } }), { status: 201 });
    }
    if (url.endsWith("/me/applications")) return new Response(JSON.stringify({ data:
      pending ? [{ _id: "application-1", chapterCode: "HN_A", status: "pending" }] : [],
    }), { status: 200 });
    return new Response(JSON.stringify({ data: [
      { code: "HN_A", name: "Chapter Hà Nội", chapterRegion: "Hà Nội", chapterAddress: "Ba Đình", chairpersonName: "Nguyễn A" },
    ] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);

  render(<ChapterPortal />);
  fireEvent.click(await screen.findByRole("button", { name: "Xem chi tiết Chapter" }));
  expect(await screen.findByText("26")).toBeTruthy();
  expect(screen.getByText("12")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Nộp đơn xin gia nhập" }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/chapters/me/applications", expect.objectContaining({
    method: "POST", body: JSON.stringify({ chapterCode: "HN_A" }),
  })));
  expect(await screen.findByText("Đơn đang chờ xác nhận")).toBeTruthy();
});
