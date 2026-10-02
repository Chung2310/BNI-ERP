// @vitest-environment jsdom
import React from "react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import MemberFeesTab from "./MemberFeesTab";
import FeeSePaySettings from "./FeeSePaySettings";

const mocks = vi.hoisted(() => ({
  sepayConfig: vi.fn(),
  transactions: vi.fn(),
  get: vi.fn(),
  notify: vi.fn(),
  list: vi.fn(),
  members: vi.fn(),
  create: vi.fn(),
  delete: vi.fn(),
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
  mocks.delete.mockReset().mockResolvedValue({ message: "Đã xóa khoản phí." });
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
  await screen.findByText("Phí thường niên");
  fireEvent.click(screen.getByRole("button", { name: "Tạo khoản phí" }));
  await screen.findByText("Nguyễn An");
  fireEvent.change(screen.getByLabelText("Số tiền mỗi thành viên (VND)"), { target: { value: "1000000" } });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Tạo cho 1 thành viên" }));
  await waitFor(() =>
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Phí thường niên", amount: 1000000, memberIds: ["member1"] })
    )
  );
});

it("displays money paid/total and people paid/total on main list, not members list", async () => {
  render(<MemberFeesTab />);
  await screen.findByText("Phí thường niên");
  // Main table shows money & people columns
  expect(screen.getByText("Số tiền (Đã đóng / Phải đóng)")).toBeTruthy();
  expect(screen.getByText("Số người (Đã đóng / Phải đóng)")).toBeTruthy();
  // Member names should not be rendered on the main table
  expect(screen.queryByText("an@example.com")).toBeNull();
});

it("records a partial payment and updates remaining balance without closing history", async () => {
  render(<MemberFeesTab />);
  fireEvent.click(await screen.findByRole("button", { name: "Xem chi tiết" }));
  await screen.findByText("Nguyễn An");
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
  await screen.findByText("Phí thường niên");
  expect(screen.queryByRole("button", { name: "Tạo khoản phí" })).toBeNull();
  fireEvent.click(await screen.findByRole("button", { name: "Xem chi tiết" }));
  await screen.findByText("Nguyễn An");
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
  fireEvent.click(await screen.findByRole("button", { name: "Xem chi tiết" }));
  await screen.findByText("Nguyễn An");
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
  render(<FeeSePaySettings onClose={() => {}} />);
  await screen.findByText("SePay đang bật");
  expect(screen.getByText(/Cấu hình được quản lý trong .env/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Lưu cấu hình" })).toBeNull();
  expect(screen.queryByLabelText("API key xác thực webhook")).toBeNull();
});


it("keeps same-name collection rounds separate", async () => {
  mocks.list.mockResolvedValue([{ ...fee, campaignId: "round-one" }, { ...fee, _id: "fee2", campaignId: "round-two" }]);
  render(<MemberFeesTab />);
  await waitFor(() => expect(screen.getAllByRole("button", { name: "Xem chi tiết" })).toHaveLength(2));
});

it("creates a fresh collection ID each time the create form opens", async () => {
  render(<MemberFeesTab />);
  for (let i = 0; i < 2; i++) {
    fireEvent.click(await screen.findByRole("button", { name: "Tạo khoản phí" }));
    fireEvent.change(screen.getByLabelText("Số tiền mỗi thành viên (VND)"), { target: { value: "1000" } });
    fireEvent.click(await screen.findByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Tạo cho 1 thành viên" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  }
  expect(mocks.create.mock.calls[0][0].campaignId).toBeTruthy();
  expect(mocks.create.mock.calls[0][0].campaignId).not.toBe(mocks.create.mock.calls[1][0].campaignId);
});

it("confirms deletion and removes the empty collection from the list", async () => {
  render(<MemberFeesTab />);
  fireEvent.click(await screen.findByRole("button", { name: "Xóa khoản chưa thu" }));
  expect(mocks.delete).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận xóa" }));
  await waitFor(() => expect(mocks.delete).toHaveBeenCalledWith("fee1"));
  await waitFor(() => expect(screen.queryByRole("button", { name: "Xem chi tiết" })).toBeNull());
});

it("keeps the row and shows a server deletion conflict", async () => {
  mocks.delete.mockRejectedValue(new Error("Khoản phí vừa được thanh toán."));
  render(<MemberFeesTab />);
  fireEvent.click(await screen.findByRole("button", { name: "Xóa khoản chưa thu" }));
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận xóa" }));
  expect(await screen.findByText("Khoản phí vừa được thanh toán.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Xem chi tiết" })).toBeTruthy();
});

it("hides deletion for members and for fees with payment history", async () => {
  mocks.manage = false;
  render(<MemberFeesTab />);
  await screen.findByRole("button", { name: "Xem chi tiết" });
  expect(screen.queryByRole("button", { name: "Xóa khoản chưa thu" })).toBeNull();
  cleanup();
  mocks.manage = true;
  mocks.list.mockResolvedValue([{ ...fee, payments: [{ id: "receipt" }] }]);
  render(<MemberFeesTab />);
  await screen.findByRole("button", { name: "Xem chi tiết" });
  expect(screen.queryByRole("button", { name: "Xóa khoản chưa thu" })).toBeNull();
});


it("adds members to the existing round without reassigning its current members", async () => {
  mocks.list.mockResolvedValue([{ ...fee, campaignId: "existing-round" }]);
  mocks.members.mockResolvedValue([{ id: "member1", name: "Nguyễn An", email: "an@example.com" }, { id: "member2", name: "Nguyễn Bình", email: "binh@example.com" }]);
  render(<MemberFeesTab />);
  fireEvent.click(await screen.findByRole("button", { name: "Xem chi tiết" }));
  fireEvent.click(screen.getByRole("button", { name: "Thêm thành viên" }));
  expect(screen.getAllByRole("checkbox")).toHaveLength(1);
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Tạo cho 1 thành viên" }));
  await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ campaignId: "existing-round", memberIds: ["member2"] })));
});
