// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RescheduleMeetingDialog } from "./RescheduleMeetingDialog";

vi.mock("../common/VietnameseDatePicker", () => ({
  VietnameseDatePicker: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => <input aria-label="Ngày mới" value={value} onChange={event => onChange(event.target.value)} />,
}));
afterEach(() => { cleanup(); vi.useRealTimers(); });

function setup() {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2030-01-01T00:00:00Z"));
  const onConfirm = vi.fn<() => Promise<void>>();
  const onClose = vi.fn();
  render(<RescheduleMeetingDialog meeting={{ title: "Họp tuần", startsAt: "2030-01-02T00:00:00Z" }} onConfirm={onConfirm} onClose={onClose} />);
  return { onConfirm, onClose };
}

it("rejects unchanged and past dates before asking for confirmation", () => {
  const { onConfirm } = setup();
  fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
  expect(screen.getByRole("alert").textContent).toContain("ngày khác");
  fireEvent.change(screen.getByLabelText("Ngày mới"), { target: { value: "2029-12-31" } });
  fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
  expect(screen.getByRole("alert").textContent).toContain("tương lai");
  expect(onConfirm).not.toHaveBeenCalled();
});

it("keeps the chosen date and shows the error if saving fails", async () => {
  const { onConfirm, onClose } = setup();
  onConfirm.mockRejectedValue(new Error("Cuộc họp đã thay đổi. Vui lòng tải lại."));
  fireEvent.change(screen.getByLabelText("Ngày mới"), { target: { value: "2030-02-03" } });
  fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận dời lịch" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Cuộc họp đã thay đổi");
  expect((screen.getByLabelText("Ngày mới") as HTMLInputElement).value).toBe("2030-02-03");
  expect(onClose).not.toHaveBeenCalled();
});
