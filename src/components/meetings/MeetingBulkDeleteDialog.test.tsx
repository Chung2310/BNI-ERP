// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MeetingBulkDeleteDialog } from "./MeetingBulkDeleteDialog";

afterEach(cleanup);

const meetings = [
  { _id: "a", title: "October one", startsAt: "2030-09-30T18:00:00Z", status: "scheduled" },
  { _id: "b", title: "October two", startsAt: "2030-10-15T00:00:00Z", status: "ended" },
  { _id: "c", title: "November", startsAt: "2030-11-01T00:00:00Z", status: "scheduled" },
];

it("filters by Vietnam month, selects visible meetings and confirms before deleting", async () => {
  const load = vi.fn().mockResolvedValue(meetings);
  const remove = vi.fn().mockResolvedValue(undefined);
  const onDeleted = vi.fn();
  render(<MeetingBulkDeleteDialog initialMonth="2030-10" load={load} remove={remove} onClose={vi.fn()} onDeleted={onDeleted} />);
  await screen.findByRole("checkbox", { name: "Chọn October one" });
  expect(screen.queryByRole("checkbox", { name: "Chọn November" })).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Chọn tất cả" }));
  expect(screen.getByText("Đã chọn 2/2")).toBeTruthy();
  expect((screen.getByRole("checkbox", { name: "Chọn October two" }) as HTMLInputElement).checked).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Xóa 2 cuộc họp" }));
  expect(remove).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Xóa 2 cuộc họp" }));
  await waitFor(() => expect(remove).toHaveBeenCalledWith(["a", "b"]));
  expect(onDeleted).toHaveBeenCalledWith(2);
});

it("shows the chosen month and clears checked meetings when the month changes", async () => {
  render(<MeetingBulkDeleteDialog initialMonth="2030-10" load={vi.fn().mockResolvedValue(meetings)} remove={vi.fn()} onClose={vi.fn()} onDeleted={vi.fn()} />);
  await screen.findByRole("checkbox", { name: "Chọn October one" });
  fireEvent.click(screen.getByRole("checkbox", { name: "Chọn October one" }));
  fireEvent.click(screen.getByRole("button", { name: "Lọc theo tháng" }));
  fireEvent.click(screen.getByRole("button", { name: "Tháng 11" }));
  expect(screen.queryByRole("checkbox", { name: "Chọn October one" })).toBeNull();
  expect(screen.getByRole("checkbox", { name: "Chọn November" })).toBeTruthy();
  expect(screen.getByText("Đã chọn 0/1")).toBeTruthy();
  fireEvent.click(screen.getByRole("checkbox", { name: "Chọn November" }));
  expect(screen.getByText("Đã chọn 1/1")).toBeTruthy();
});

it("searches meeting names within the chosen month and selects only matching results", async () => {
  const remove = vi.fn().mockResolvedValue(undefined);
  render(<MeetingBulkDeleteDialog initialMonth="2030-10" load={vi.fn().mockResolvedValue(meetings)} remove={remove} onClose={vi.fn()} onDeleted={vi.fn()} />);
  await screen.findByRole("checkbox", { name: "Chọn October one" });
  fireEvent.change(screen.getByRole("searchbox", { name: "Tìm cuộc họp" }), { target: { value: "TWO" } });
  expect(screen.queryByRole("checkbox", { name: "Chọn October one" })).toBeNull();
  expect(screen.getByRole("checkbox", { name: "Chọn October two" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Chọn tất cả" }));
  expect(screen.getByText("Đã chọn 1/1")).toBeTruthy();
  fireEvent.change(screen.getByRole("searchbox", { name: "Tìm cuộc họp" }), { target: { value: "missing" } });
  expect(screen.getByText("Đã chọn 0/0")).toBeTruthy();
  expect(screen.getByText("Không tìm thấy cuộc họp phù hợp trong tháng này.")).toBeTruthy();
  expect(remove).not.toHaveBeenCalled();
});
