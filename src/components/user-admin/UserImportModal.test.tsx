// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import UserImportModal from "./UserImportModal";
const mocks = vi.hoisted(() => ({ parse: vi.fn(), submit: vi.fn(), template: vi.fn() }));
vi.mock("../../utils/userImportExcel", () => ({ parseUserImportExcel: mocks.parse, downloadUserImportTemplate: mocks.template }));
vi.mock("../../services/userImportService", () => ({ submitUserImport: mocks.submit }));
afterEach(cleanup);
const rows = [{ rowNumber: 2, displayName: "An", email: "an@test.com", phone: "", companyName: "", industry: "", birthDate: "" }];
beforeEach(() => {
  mocks.parse.mockReset().mockReturnValue(rows);
  mocks.submit.mockReset().mockResolvedValueOnce({ rows: [{ rowNumber: 2, email: "an@test.com", status: "valid", message: "Sẵn sàng" }] })
    .mockResolvedValue({ rows: [{ rowNumber: 2, email: "an@test.com", status: "created", message: "Đã tạo" }] });
});
function upload() {
  const file = new File(["example"], "members.xlsx");
  Object.defineProperty(file, "arrayBuffer", { value: async () => new ArrayBuffer(1) });
  fireEvent.change(screen.getByLabelText("Chọn file Excel"), { target: { files: [file] } });
}
it("requires preview then explicit import and refreshes the account list", async () => {
  const onComplete = vi.fn();
  render(<UserImportModal onClose={vi.fn()} onComplete={onComplete} />);
  expect(screen.getByText("123456")).toBeTruthy();
  upload(); await screen.findByText("Sẵn sàng");
  expect(mocks.submit).toHaveBeenCalledTimes(1);
  expect(mocks.submit).toHaveBeenLastCalledWith(rows, true);
  fireEvent.click(screen.getByRole("button", { name: "Nhập 1 tài khoản hợp lệ" }));
  await screen.findByText("Đã tạo");
  expect(mocks.submit).toHaveBeenLastCalledWith(rows, false);
  await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
});
it("requires rechecking after an interrupted import rather than silently reporting success", async () => {
  mocks.submit.mockReset().mockResolvedValueOnce({ rows: [{ rowNumber: 2, email: "an@test.com", status: "valid", message: "Sẵn sàng" }] }).mockRejectedValue(new Error("Mất kết nối"));
  render(<UserImportModal onClose={vi.fn()} onComplete={vi.fn()} />);
  upload(); await screen.findByText("Sẵn sàng");
  fireEvent.click(screen.getByRole("button", { name: "Nhập 1 tài khoản hợp lệ" }));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("Kiểm tra lại"));
  expect((screen.getByRole("button", { name: "Nhập 1 tài khoản hợp lệ" }) as HTMLButtonElement).disabled).toBe(true);
});
