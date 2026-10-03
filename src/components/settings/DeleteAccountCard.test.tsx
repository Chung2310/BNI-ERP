// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import DeleteAccountCard from "./DeleteAccountCard";
const auth = vi.hoisted(() => ({ userProfile: { role: "user", email: "me@example.com" }, deleteOwnAccount: vi.fn() }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("../../pages/Toast", () => ({ toast: { error: vi.fn() } }));
afterEach(cleanup);
beforeEach(() => { auth.userProfile.role = "user"; auth.deleteOwnAccount.mockReset().mockResolvedValue(undefined); });
function openForm() {
  render(<DeleteAccountCard />);
  fireEvent.click(screen.getByRole("button", { name: "Xóa tài khoản của tôi" }));
}
it("requires both password and confirmation before submitting", async () => {
  openForm();
  const submit = screen.getByRole("button", { name: "Xóa vĩnh viễn tài khoản" }) as HTMLButtonElement;
  expect(submit.disabled).toBe(true);
  fireEvent.change(screen.getByLabelText("Mật khẩu hiện tại"), { target: { value: "password" } });
  expect(submit.disabled).toBe(true);
  fireEvent.change(screen.getByLabelText("Nhập XÓA TÀI KHOẢN để xác nhận"), { target: { value: "XÓA TÀI KHOẢN" } });
  fireEvent.click(submit);
  await waitFor(() => expect(auth.deleteOwnAccount).toHaveBeenCalledWith("password", "XÓA TÀI KHOẢN"));
});
it("cancels without deleting and clears credentials", () => {
  openForm();
  fireEvent.change(screen.getByLabelText("Mật khẩu hiện tại"), { target: { value: "password" } });
  fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
  fireEvent.click(screen.getByRole("button", { name: "Xóa tài khoản của tôi" }));
  expect((screen.getByLabelText("Mật khẩu hiện tại") as HTMLInputElement).value).toBe("");
  expect(auth.deleteOwnAccount).not.toHaveBeenCalled();
});
it("retains the account and permits retry after a deletion error", async () => {
  auth.deleteOwnAccount.mockRejectedValueOnce(new Error("Sai mật khẩu"));
  openForm();
  fireEvent.change(screen.getByLabelText("Mật khẩu hiện tại"), { target: { value: "wrong" } });
  fireEvent.change(screen.getByLabelText("Nhập XÓA TÀI KHOẢN để xác nhận"), { target: { value: "XÓA TÀI KHOẢN" } });
  fireEvent.click(screen.getByRole("button", { name: "Xóa vĩnh viễn tài khoản" }));
  await waitFor(() => expect((screen.getByLabelText("Mật khẩu hiện tại") as HTMLInputElement).value).toBe(""));
  expect((screen.getByRole("button", { name: "Hủy" }) as HTMLButtonElement).disabled).toBe(false);
});
it("does not offer self-deletion to administrators", () => {
  auth.userProfile.role = "admin";
  render(<DeleteAccountCard />);
  expect(screen.queryByRole("button", { name: "Xóa tài khoản của tôi" })).toBeNull();
});