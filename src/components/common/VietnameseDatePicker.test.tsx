// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { VietnameseDatePicker } from "./VietnameseDatePicker";

describe("VietnameseDatePicker", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders with placeholder and opens Vietnamese calendar popup", () => {
    const handleChange = vi.fn();
    render(<VietnameseDatePicker value="" onChange={handleChange} placeholder="Chọn ngày..." />);

    expect(screen.getByText("Chọn ngày...")).toBeTruthy();

    // Click to open popup
    fireEvent.click(screen.getByRole("button", { name: "Chọn ngày" }));

    // Verify dialog opens
    const dialog = screen.getByRole("dialog", { name: "Lịch chọn ngày" });
    expect(dialog).toBeTruthy();

    // Verify Vietnamese weekdays T2, T3, ..., CN
    expect(within(dialog).getByText("T2")).toBeTruthy();
    expect(within(dialog).getByText("T6")).toBeTruthy();
    expect(within(dialog).getByText("CN")).toBeTruthy();

    // Verify Vietnamese action buttons
    expect(within(dialog).getByRole("button", { name: "Hôm nay" })).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Đóng" })).toBeTruthy();
  });

  it("formats value as DD/MM/YYYY and allows clearing", () => {
    const handleChange = vi.fn();
    render(<VietnameseDatePicker value="2026-10-12" onChange={handleChange} />);

    // Value 2026-10-12 should display as 12/10/2026
    expect(screen.getByText("12/10/2026")).toBeTruthy();

    // Clear button should be visible
    const clearBtn = screen.getByRole("button", { name: "Xóa ngày đã chọn" });
    fireEvent.click(clearBtn);

    expect(handleChange).toHaveBeenCalledWith("");
  });

  it("selects a day and emits YYYY-MM-DD", () => {
    const handleChange = vi.fn();
    render(<VietnameseDatePicker value="2026-10-01" onChange={handleChange} />);

    // Open picker
    fireEvent.click(screen.getByRole("button", { name: "Chọn ngày" }));

    const dialog = screen.getByRole("dialog", { name: "Lịch chọn ngày" });
    // Click day 15 inside dialog
    const day15 = within(dialog).getByRole("button", { name: "15" });
    fireEvent.click(day15);

    expect(handleChange).toHaveBeenCalledWith("2026-10-15");
  });

  it("selects today when clicking Hôm nay", () => {
    const handleChange = vi.fn();
    render(<VietnameseDatePicker value="" onChange={handleChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Chọn ngày" }));
    const dialog = screen.getByRole("dialog", { name: "Lịch chọn ngày" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Hôm nay" }));

    const today = new Date();
    const expected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    expect(handleChange).toHaveBeenCalledWith(expected);
  });
});
