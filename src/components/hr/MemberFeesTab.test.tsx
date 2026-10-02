// @vitest-environment jsdom
import React from "react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import MemberFeesTab from "./MemberFeesTab";

const mocks = vi.hoisted(() => ({
  sepayConfig: vi.fn(),
  transactions: vi.fn(),
  get: vi.fn(),
  notify: vi.fn(),
  list: vi.fn(),
  members: vi.fn(),
  create: vi.fn(),
  receive: vi.fn(),
  voidPayment: vi.fn(),
  manage: true
}));

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    userProfile: { role: mocks.manage ? "admin" : "user" },
    hasPermission: () => true
  })
}));
vi.mock("../../services/memberFeeService", () => ({ memberFeeService: mocks }));
vi.mock("../../pages/Toast", () => ({ toast: { success: vi.fn() } }));

const fee = {
  _id: "fee1",
  memberId: "member1",
  memberName: "Nguyễn An",
  memberEmail: "an@example.com",
  year: 2026,
  title: "Phí thường niên",
  amount: 1000000,
  dueDate: "2026-12-31",
  note: "",
  paid: 0,
  remaining: 1000000,
  status: "unpaid",
  payments: []
};

beforeEach(() => {
  mocks.manage = true;
  window.history.replaceState(null, "", "/");
  mocks.get.mockReset().mockResolvedValue(fee);
  mocks.notify.mockReset().mockResolvedValue(fee);
  mocks.list.mockReset().mockResolvedValue([fee]);
  mocks.members.mockReset().mockResolvedValue([{ id: "member1", name: "Nguyễn An", email: "an@example.com" }]);
  mocks.create.mockReset().mockResolvedValue({ created: 1, skipped: 0 });
  mocks.receive.mockReset().mockResolvedValue({ ...fee, paid: 400000, remaining: 600000, status: "partial" });
});
afterEach(cleanup);

it("creates a fee for selected members and the selected year", async () => {
  render(<MemberFeesTab />);
  await screen.findByText("Nguyễn An");
  fireEvent.click(screen.getByRole("button", { name: "Tạo khoản phí" }));
  fireEvent.change(screen.getByLabelText("Số tiền mỗi thành viên (VND)"), { target: { value: "1000000" } });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Tạo cho 1 thành viên" }));
  await waitFor(() =>
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Phí thường niên", amount: 1000000, memberIds: ["member1"] })
    )
  );
});

it("records a partial payment and updates remaining balance without closing history", async () => {
  render(<MemberFeesTab />);
  fireEvent.click(await screen.findByRole("button", { name: "Thanh toán" }));
  fireEvent.change(screen.getByLabelText("Số tiền thu (VND)"), { target: { value: "400000" } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu phiếu thu" }));
  await waitFor(() =>
    expect(mocks.receive).toHaveBeenCalledWith("fee1", expect.objectContaining({ amount: 400000, method: "transfer" }))
  );
  await screen.findByText("Đóng một phần", { selector: "span" });
  expect(screen.getByRole("dialog")).toBeTruthy();
});

it("read-only users cannot create fees or record receipts", async () => {
  mocks.manage = false;
  render(<MemberFeesTab />);
  await screen.findByText("Nguyễn An");
  expect(screen.queryByRole("button", { name: "Tạo khoản phí" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Thanh toán" }));
  expect(screen.queryByRole("button", { name: "Lưu phiếu thu" })).toBeNull();
});

it("opens the fee QR from a notification deep link for an ordinary member", async () => {
  mocks.manage = false;
  window.history.replaceState(null, "", "/?fee=fee1");
  mocks.get.mockResolvedValue({
    ...fee,
    checkout: {
      bank: "Vietcombank",
      accountNumber: "123456789",
      accountName: "BNI TEST",
      paymentCode: "BNI0123456789ABCDEF0123",
      amount: 1000000,
      qrUrl: "https://vietqr.app/img?acc=123456789"
    }
  });
  render(<MemberFeesTab />);
  expect(await screen.findByAltText("QR chuyển khoản khoản phí")).toBeTruthy();
  expect(screen.getByText("BNI0123456789ABCDEF0123")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Gửi thông báo & email QR" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Lưu phiếu thu" })).toBeNull();
});

it("lets admin send a fee notification and exposes the outstanding QR", async () => {
  render(<MemberFeesTab />);
  fireEvent.click(await screen.findByRole("button", { name: "Thanh toán" }));
  fireEvent.click(await screen.findByRole("button", { name: "Gửi thông báo & email QR" }));
  await waitFor(() => expect(mocks.notify).toHaveBeenCalledWith("fee1"));
  await screen.findByText(/Đã gửi thông báo trong ứng dụng và email kèm mã QR/);
});

it("shows environment config read-only without a secret input or save button", async () => {
  mocks.sepayConfig.mockResolvedValue({
    enabled: true,
    bank: "Vietcombank",
    accountNumber: "123456789",
    accountName: "BNI TEST",
    hasApiKey: true,
    webhookPath: "/api/v1/webhook/sepay/A"
  });
  mocks.transactions.mockResolvedValue([]);
  render(<MemberFeesTab />);
  fireEvent.click(screen.getByRole("button", { name: "SePay & giao dịch" }));
  await screen.findByText("SePay đang bật");
  expect(screen.getByText(/Cấu hình được quản lý trong .env/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Lưu cấu hình" })).toBeNull();
  expect(screen.queryByLabelText("API key xác thực webhook")).toBeNull();
});
