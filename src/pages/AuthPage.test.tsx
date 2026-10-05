// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const login = vi.hoisted(() => vi.fn().mockResolvedValue({}));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ loginWithIdentifier: login }) }));
import AuthPage from "./AuthPage";
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it.each(["0901234567", "+84 901 234 567", "member@example.com"])("submits %s and preserves password whitespace", async identifier => {
 render(<AuthPage />);
 fireEvent.change(screen.getByLabelText(/Số điện thoại hoặc email/), { target: { value: identifier } });
 fireEvent.change(screen.getByLabelText(/Mật khẩu/), { target: { value: " pass123 " } });
 fireEvent.click(screen.getByRole("button", { name: /Đăng nhập hệ thống/ }));
 await waitFor(() => expect(login).toHaveBeenCalledWith(identifier, " pass123 ", true));
});
it("blocks malformed identifiers before submitting", () => {
 render(<AuthPage />);
 fireEvent.change(screen.getByLabelText(/Số điện thoại hoặc email/), { target: { value: "invalid" } });
 fireEvent.change(screen.getByLabelText(/Mật khẩu/), { target: { value: "pass123" } });
 fireEvent.click(screen.getByRole("button", { name: /Đăng nhập hệ thống/ }));
 expect(login).not.toHaveBeenCalled();
 expect(screen.getByText(/không đúng định dạng/)).toBeTruthy();
});
