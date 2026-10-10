// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ChapterRegistrationPage from "./ChapterRegistrationPage";
import { authService } from "../services/authService";

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ loginWithIdentifier: vi.fn(), refreshProfile: vi.fn() }),
}));
vi.mock("../services/authService", () => ({
  authService: { registerWithEmail: vi.fn() },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

test("shows a Vietnamese required error for every missing registration field", () => {
  render(<ChapterRegistrationPage />);
  fireEvent.click(screen.getByRole("button", { name: "Tạo tài khoản" }));

  for (const label of ["họ và tên", "email", "số điện thoại", "công ty", "lĩnh vực", "mật khẩu"]) {
    expect(screen.getByText(`Vui lòng nhập ${label}.`)).toBeTruthy();
  }
  expect(authService.registerWithEmail).not.toHaveBeenCalled();
});

test("shows format errors, then submits corrected values", async () => {
  vi.mocked(authService.registerWithEmail).mockRejectedValue(new Error("Email đã được sử dụng."));
  render(<ChapterRegistrationPage />);
  fireEvent.change(screen.getByLabelText("Họ và tên *"), { target: { value: "Nguyễn Văn A" } });
  fireEvent.change(screen.getByLabelText("Email *"), { target: { value: "sai-email" } });
  fireEvent.change(screen.getByLabelText("Số điện thoại *"), { target: { value: "0123456789" } });
  fireEvent.change(screen.getByLabelText("Công ty *"), { target: { value: "Công ty A" } });
  fireEvent.change(screen.getByLabelText("Lĩnh vực *"), { target: { value: "Bán lẻ" } });
  fireEvent.change(screen.getByLabelText("Mật khẩu *"), { target: { value: "1234567" } });
  fireEvent.click(screen.getByRole("button", { name: "Tạo tài khoản" }));

  expect(screen.getByText("Email không đúng định dạng.")).toBeTruthy();
  expect(screen.getByText("Số điện thoại không đúng định dạng (ví dụ: 0987654321).")).toBeTruthy();
  expect(screen.getByText("Mật khẩu phải có ít nhất 8 ký tự.")).toBeTruthy();
  expect(authService.registerWithEmail).not.toHaveBeenCalled();

  fireEvent.change(screen.getByLabelText("Email *"), { target: { value: "a@example.com" } });
  fireEvent.change(screen.getByLabelText("Số điện thoại *"), { target: { value: "0987654321" } });
  fireEvent.change(screen.getByLabelText("Mật khẩu *"), { target: { value: "12345678" } });
  fireEvent.click(screen.getByRole("button", { name: "Tạo tài khoản" }));

  await waitFor(() => expect(authService.registerWithEmail).toHaveBeenCalledWith(
    "a@example.com", "12345678", "Nguyễn Văn A",
    { phone: "0987654321", companyName: "Công ty A", industry: "Bán lẻ" },
  ));
  expect(screen.getByRole("alert").textContent).toBe("Email đã được sử dụng.");
});
