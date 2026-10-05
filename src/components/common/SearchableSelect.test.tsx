// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchableSelect } from "./SearchableSelect";

afterEach(cleanup);

const options = [
  { value: "all", label: "Tất cả cuộc họp (2)" },
  { value: "meeting-1", label: "02/10 - Kết nối doanh nghiệp", searchText: "Khách sạn Đà Nẵng" },
  { value: "meeting-2", label: "03/10 - Họp tháng", searchText: "Hà Nội" },
];

it("searches Vietnamese meeting titles and locations without accents and selects the matching ID", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<SearchableSelect options={options} value="all" onChange={onChange} ariaLabel="Chọn buổi họp" compact />);
  const trigger = screen.getByRole("button", { name: "Chọn buổi họp" });
  await user.click(trigger);
  const search = screen.getByRole("textbox", { name: "Tìm kiếm..." });
  expect(document.activeElement).toBe(search);
  await user.type(search, "KET NOI");
  expect(screen.getByRole("button", { name: options[1].label })).toBeTruthy();
  expect(screen.queryByRole("button", { name: options[2].label })).toBeNull();
  await user.clear(search);
  await user.type(search, " da nang ");
  await user.click(screen.getByRole("button", { name: options[1].label }));
  expect(onChange).toHaveBeenCalledExactlyOnceWith("meeting-1");
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(document.activeElement).toBe(trigger);
  await user.click(trigger);
  await user.click(screen.getByRole("button", { name: options[0].label }));
  expect(onChange).toHaveBeenLastCalledWith("all");
});

it("handles no results, clearing search, and Escape without changing the current meeting", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<SearchableSelect options={options} value="meeting-1" onChange={onChange} ariaLabel="Chọn buổi họp" />);
  const trigger = screen.getByRole("button", { name: "Chọn buổi họp" });
  await user.click(trigger);
  await user.type(screen.getByRole("textbox"), "không tồn tại");
  expect(screen.getByText("Không tìm thấy kết quả")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Xóa tìm kiếm" }));
  expect(screen.getByRole("button", { name: options[2].label })).toBeTruthy();
  await user.keyboard("{Escape}");
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  expect(document.activeElement).toBe(trigger);
  expect(onChange).not.toHaveBeenCalled();
});
