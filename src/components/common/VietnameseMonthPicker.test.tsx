// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VietnameseMonthPicker } from "./VietnameseMonthPicker";

afterEach(cleanup);

it("shows Vietnamese months, highlights the selected month and selects a month in another year", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<VietnameseMonthPicker value="2026-10" onChange={onChange} currentMonth="2026-10" />);
  const trigger = screen.getByRole("button", { name: "Tháng xem lịch" });
  expect(trigger.textContent).toBe("Tháng 10, 2026");
  await user.click(trigger);
  const dialog = within(screen.getByRole("dialog", { name: "Chọn tháng và năm" }));
  expect(dialog.getAllByRole("button", { name: /^Tháng \d+$/ })).toHaveLength(12);
  expect(document.activeElement).toBe(dialog.getByRole("button", { name: "Tháng 10" }));
  await user.click(dialog.getByRole("button", { name: "Năm sau" }));
  expect(dialog.getByText("Năm 2027")).toBeTruthy();
  await user.click(dialog.getByRole("button", { name: "Tháng 2" }));
  expect(onChange).toHaveBeenCalledExactlyOnceWith("2027-02");
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(trigger);
});

it("closes with Escape without changing the selection and returns to the current month", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<VietnameseMonthPicker value="2027-02" onChange={onChange} currentMonth="2026-10" />);
  const trigger = screen.getByRole("button", { name: "Tháng xem lịch" });
  await user.click(trigger);
  await user.click(screen.getByRole("button", { name: "Năm trước" }));
  await user.keyboard("{Escape}");
  expect(onChange).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(trigger);
  await user.click(trigger);
  expect(screen.getByText("Năm 2027")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Tháng hiện tại" }));
  expect(onChange).toHaveBeenCalledExactlyOnceWith("2026-10");
});
