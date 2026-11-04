// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { ExpoCampaign } from "./ExpoCampaign";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
});

test("reading and previewing campaign images stays on the same page", () => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };

  render(<ExpoCampaign />);

  expect(screen.getByRole("link", { name: "Xem cách tham dự" }).getAttribute("href")).toBe("#expo-ve-tham-du");
  expect(screen.getByRole("img", { name: "Thư mời BNI EXPO và lịch trình chương trình" }).closest("a")).toBeNull();
  expect(screen.getByRole("button", { name: "Xem thư mời tài trợ gốc" })).not.toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Xem ảnh thư mời lớn hơn" }));
  expect(screen.getByRole("dialog", { name: "Xem ảnh chiến dịch" }).hasAttribute("open")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Đóng ảnh" }));
  expect(document.querySelector("dialog")?.hasAttribute("open")).toBe(false);

  fireEvent.click(screen.getByRole("button", { name: "Xem thư mời tài trợ gốc" }));
  expect(screen.getByRole("dialog", { name: "Xem ảnh chiến dịch" }).querySelector("img")?.getAttribute("src")).toBe("/expo-bac-ninh/thu-moi-tai-tro.jpg");

  expect(screen.getByRole("link", { name: /Mở trang đăng ký vé tham dự/ }).getAttribute("target")).toBe("_blank");
});

test("the Bronze package follows the two benefits marked on the poster", () => {
  render(<ExpoCampaign />);

  const bronze = screen.getByRole("heading", { name: "Đối tác Đồng" }).closest("article");
  expect(bronze).not.toBeNull();
  expect(within(bronze!).getAllByRole("listitem")).toHaveLength(2);
  expect(within(bronze!).getByText("Bằng vinh danh")).not.toBeNull();
  expect(within(bronze!).getByText("Tặng gian hàng trưng bày và vé tham gia")).not.toBeNull();
});
