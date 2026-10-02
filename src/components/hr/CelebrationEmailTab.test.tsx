// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CelebrationEmailTab from "./CelebrationEmailTab";
import { toast } from "../../pages/Toast";

const getCelebration = vi.hoisted(() => vi.fn());
const history = vi.hoisted(() => vi.fn());
const saveCelebration = vi.hoisted(() => vi.fn());
const preview = vi.hoisted(() => vi.fn());

vi.mock("../../services/companyEmailService", () => ({
  companyEmailApi: {
    getCelebration,
    history,
    saveCelebration,
    preview,
  },
}));

vi.mock("../../services/authService", () => ({
  authService: {
    uploadManagedFile: vi.fn(),
  },
}));

vi.mock("../../pages/Toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));


async function openHolidaySettings() {
  const button = screen.getByRole("button", { name: "Cấu hình ngày lễ" });
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(button);
  return screen.getByRole("dialog", { name: "Cấu hình ngày lễ" });
}

describe("CelebrationEmailTab variable palettes", () => {
  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  it("limits each HR email template to its relevant variable palette", async () => {
    getCelebration.mockResolvedValue({
      birthdayEnabled: true,
      holidayEnabled: true,
      sendTime: "08:00",
      birthdayTemplate: {
        subject: "Chúc mừng sinh nhật {{employeeName}}",
        html: "<p>Thân gửi {{employeeName}} từ {{companyName}}</p>",
      },
      holidayTemplate: {
        subject: "Chúc mừng {{holidayName}}",
        html: "<p>{{companyName}} chúc mừng {{holidayName}}</p>",
      },
      holidayOverrides: [],
    });
    history.mockResolvedValue([]);

    render(<CelebrationEmailTab />);

    const birthdayTitle = await screen.findByText(/Mẫu thư chúc mừng sinh nhật/i);
    expect(birthdayTitle).toBeTruthy();

    const birthdaySection = birthdayTitle.closest("section");
    const holidayTitle = screen.getByText(/Mẫu thư chúc mừng lễ\/Tết/i);
    const holidaySection = holidayTitle.closest("section");

    if (!(birthdaySection instanceof HTMLElement) || !(holidaySection instanceof HTMLElement)) {
      throw new Error("Template sections are not present");
    }

    expect(within(birthdaySection).getAllByText(/\[Tên thành viên\]/i).length).toBeGreaterThan(0);
    expect(within(birthdaySection).getAllByRole("button", { name: /Tên thành viên/i }).length).toBeGreaterThan(0);
    expect(within(birthdaySection).queryByRole("button", { name: /Tên ngày lễ/i })).toBeNull();

    expect(within(holidaySection).getByRole("button", { name: /Tên ngày lễ/i })).toBeTruthy();
  });
  it("adds, previews and saves named holidays with the configured send time", async () => {
    getCelebration.mockResolvedValue({ holidayEnabled: true, holidayOverrides: [] });
    history.mockResolvedValue([]);
    saveCelebration.mockResolvedValue({});
    preview.mockResolvedValue({ subject: "Chúc mừng Quốc khánh", html: "<p>Lời chúc</p>" });
    render(<CelebrationEmailTab />);
    await waitFor(() => expect((screen.getByRole("button", { name: "Cấu hình ngày lễ" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.change(screen.getByLabelText("Giờ gửi tự động"), { target: { value: "09:30" } });
    await openHolidaySettings();
    fireEvent.click(screen.getByRole("button", { name: "Thêm ngày lễ" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Tên ngày lễ" }), { target: { value: "Quốc khánh" } });
    fireEvent.change(within(screen.getByRole("dialog", { name: "Thêm ngày lễ" })).getByLabelText("Ngày gửi"), { target: { value: "2027-09-02" } });
    fireEvent.click(screen.getByRole("button", { name: "Thêm vào danh sách" }));
    expect(screen.queryByRole("dialog", { name: "Thêm ngày lễ" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Xem trước ngày lễ" }));
    await waitFor(() => expect(preview).toHaveBeenCalledWith(expect.objectContaining({ holidayName: "Quốc khánh" })));
    fireEvent.click(screen.getByRole("button", { name: "Đóng bản xem trước" }));
    fireEvent.click(screen.getByRole("button", { name: "Lưu cấu hình" }));
    await waitFor(() => expect(saveCelebration).toHaveBeenCalledWith(expect.objectContaining({
      holidayEnabled: true, sendTime: "09:30", holidayOverrides: [{ name: "Quốc khánh", date: "2027-09-02", enabled: true }],
    })));
  });

  it("loads existing holidays and persists disabling and removing them", async () => {
    getCelebration.mockResolvedValue({ holidayEnabled: false, holidayOverrides: [
      { name: "Quốc khánh", date: "2027-09-02", enabled: true },
      { name: "Tết", date: "2027-02-06", enabled: true },
    ] });
    history.mockResolvedValue([]);
    render(<CelebrationEmailTab />);
    await openHolidaySettings();
    await screen.findByDisplayValue("Quốc khánh");
    fireEvent.click(screen.getAllByLabelText("Bật gửi ngày lễ")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Xóa ngày lễ 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Lưu cấu hình" }));
    await waitFor(() => expect(saveCelebration).toHaveBeenCalledWith(expect.objectContaining({ holidayOverrides: [
      { name: "Quốc khánh", date: "2027-09-02", enabled: false },
    ] })));
  });

  it("rejects missing names and duplicate holiday dates before saving", async () => {
    getCelebration.mockResolvedValue({ holidayOverrides: [{ name: "", date: "2027-09-02", enabled: true }] });
    history.mockResolvedValue([]);
    render(<CelebrationEmailTab />);
    await openHolidaySettings();
    await screen.findByDisplayValue("2027-09-02");
    fireEvent.click(screen.getByRole("button", { name: "Lưu cấu hình" }));
    expect(saveCelebration).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Vui lòng nhập tên và ngày gửi cho từng ngày lễ.");
    fireEvent.change(screen.getByRole("textbox", { name: "Tên ngày lễ" }), { target: { value: "Quốc khánh" } });
    fireEvent.click(screen.getByRole("button", { name: "Thêm ngày lễ" }));
    const addDialog = within(screen.getByRole("dialog", { name: "Thêm ngày lễ" }));
    fireEvent.change(addDialog.getByRole("textbox", { name: "Tên ngày lễ" }), { target: { value: "Ngày khác" } });
    fireEvent.change(addDialog.getByLabelText("Ngày gửi"), { target: { value: "2027-09-02" } });
    fireEvent.click(addDialog.getByRole("button", { name: "Thêm vào danh sách" }));
    expect(saveCelebration).not.toHaveBeenCalled();
    expect(addDialog.getByRole("alert").textContent).toContain("Đã có ngày lễ bổ sung");
  });

  it("shows automatic holidays, recalculates the selected year and saves recurring exclusions", async () => {
    getCelebration.mockResolvedValue({ holidayEnabled: true, holidayOverrides: [] });
    history.mockResolvedValue([]);
    render(<CelebrationEmailTab />);
    await openHolidaySettings();
    fireEvent.change(screen.getByLabelText("Năm xem lịch"), { target: { value: "2026" } });
    expect(screen.getByText(/17\/02\/2026/)).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: /Tết Nguyên đán/ }));
    fireEvent.change(screen.getByLabelText("Năm xem lịch"), { target: { value: "2027" } });
    expect(screen.getByText(/06\/02\/2027/)).toBeTruthy();
    expect((screen.getByRole("checkbox", { name: /Tết Nguyên đán/ }) as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Lưu cấu hình" }));
    await waitFor(() => expect(saveCelebration).toHaveBeenCalledWith(expect.objectContaining({
      vietnameseHolidaysEnabled: true, disabledVietnameseHolidays: ["tet"], holidayOverrides: [],
    })));
  });

  it("hides configuration until opened and keeps edits when the popup closes", async () => {
    getCelebration.mockResolvedValue({ holidayOverrides: [] });
    history.mockResolvedValue([]);
    render(<CelebrationEmailTab />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByLabelText("Năm xem lịch")).toBeNull();
    await openHolidaySettings();
    fireEvent.click(screen.getByRole("button", { name: "Thêm ngày lễ" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Tên ngày lễ" }), { target: { value: "Ngày thành lập" } });
    fireEvent.change(within(screen.getByRole("dialog", { name: "Thêm ngày lễ" })).getByLabelText("Ngày gửi"), { target: { value: "2027-10-15" } });
    fireEvent.click(screen.getByRole("button", { name: "Thêm vào danh sách" }));
    fireEvent.click(screen.getByRole("button", { name: "Đóng cấu hình ngày lễ" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(saveCelebration).not.toHaveBeenCalled();
    await openHolidaySettings();
    expect(screen.getByDisplayValue("Ngày thành lập")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("cancels the separate add popup without inserting a holiday or closing settings", async () => {
    getCelebration.mockResolvedValue({ holidayOverrides: [] });
    history.mockResolvedValue([]);
    render(<CelebrationEmailTab />);
    await openHolidaySettings();
    fireEvent.click(screen.getByRole("button", { name: "Thêm ngày lễ" }));
    expect(screen.getByRole("dialog", { name: "Thêm ngày lễ" })).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: "Cấu hình ngày lễ" })).toBeNull();
    fireEvent.change(screen.getByRole("textbox", { name: "Tên ngày lễ" }), { target: { value: "Bản nháp" } });
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    expect(screen.getByRole("dialog", { name: "Cấu hình ngày lễ" })).toBeTruthy();
    expect(screen.queryByDisplayValue("Bản nháp")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Thêm ngày lễ" }));
    expect((screen.getByRole("textbox", { name: "Tên ngày lễ" }) as HTMLInputElement).value).toBe("");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Thêm ngày lễ" })).toBeNull();
    expect(screen.getByRole("dialog", { name: "Cấu hình ngày lễ" })).toBeTruthy();
    expect(saveCelebration).not.toHaveBeenCalled();
  });

  it("shows unsaved changes and only clears them after a successful save", async () => {
    getCelebration.mockResolvedValue({ holidayOverrides: [] });
    history.mockResolvedValue([]);
    render(<CelebrationEmailTab />);
    await screen.findByText("Đã đồng bộ cấu hình");
    fireEvent.click(screen.getByLabelText("Tự động sinh nhật"));
    expect(screen.getByText("Có thay đổi chưa lưu")).toBeTruthy();
    saveCelebration.mockRejectedValueOnce(new Error("Không thể lưu"));
    fireEvent.click(screen.getByRole("button", { name: "Lưu cấu hình" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Không thể lưu"));
    expect(screen.getByText("Có thay đổi chưa lưu")).toBeTruthy();
    saveCelebration.mockResolvedValueOnce({});
    fireEvent.click(screen.getByRole("button", { name: "Lưu cấu hình" }));
    await screen.findByText("Đã đồng bộ cấu hình");
    expect(screen.queryByText("Có thay đổi chưa lưu")).toBeNull();
  });

  it("filters delivery history and displays a useful empty state", async () => {
    getCelebration.mockResolvedValue({});
    history.mockResolvedValue([
      { _id: "sent", recipientEmail: "sent@example.com", eventType: "holiday", eventDate: "2026-09-02", status: "sent" },
      { _id: "failed", recipientEmail: "failed@example.com", eventType: "birthday", eventDate: "2026-09-03", status: "failed" },
    ]);
    render(<CelebrationEmailTab />);
    await screen.findByText("sent@example.com");
    fireEvent.change(screen.getByLabelText("Trạng thái gửi"), { target: { value: "failed" } });
    expect(screen.queryByText("sent@example.com")).toBeNull();
    expect(screen.getByText("failed@example.com")).toBeTruthy();
    expect(screen.getByText("03/09/2026")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Trạng thái gửi"), { target: { value: "sending" } });
    expect(screen.getByText("Không có email ở trạng thái này.")).toBeTruthy();
  });

});
