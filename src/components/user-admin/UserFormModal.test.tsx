// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { UserFormModal, type UserFormModalProps } from "./UserFormModal";
vi.mock("../../services/authService", () => ({ authService: { uploadManagedFile: vi.fn() } }));
vi.mock("../../pages/Toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
afterEach(cleanup);
const changeRole = vi.fn();
const props = {
  open: true, onClose: vi.fn(), editingUser: { uid: "member-1", role: "user" },
  userProfile: { uid: "admin-1", role: "admin" }, userRole: "user", setUserRole: changeRole,
  userDisplayName: "Nguyễn An", userCompanyName: "BNI", userIndustry: "", userEmail: "an@example.com",
  userPhone: "", userBirthDate: "", userPhotoURL: "", userCoverImage: "", userPassword: "", userCompanyCode: "BNI",
  setUserDisplayName: vi.fn(), setUserCompanyName: vi.fn(), setUserIndustry: vi.fn(), setUserEmail: vi.fn(),
  setUserPhone: vi.fn(), setUserBirthDate: vi.fn(), setUserPhotoURL: vi.fn(), setUserCoverImage: vi.fn(), setUserPassword: vi.fn(),
  onSubmit: vi.fn((event: React.FormEvent) => event.preventDefault()), submittingUser: false,
} as unknown as UserFormModalProps;
it("lets admin select Admin or Member inside the profile popup", () => {
  changeRole.mockClear();
  render(<UserFormModal {...props} />);
  const select = screen.getByLabelText("Vai trò") as HTMLSelectElement;
  expect(select.disabled).toBe(false);
  expect([...select.options].map(option => [option.value, option.text])).toEqual([["user", "Member (Thành viên)"], ["admin", "Admin (Quản trị viên)"]]);
  fireEvent.change(select, { target: { value: "admin" } });
  expect(changeRole).toHaveBeenCalledWith("admin");
  expect(screen.queryByText(/Cấu hình phân quyền, phòng ban/)).toBeNull();
});
it.each([
  { editingUser: { uid: "admin-1", role: "admin" }, userRole: "admin", lockRole: true },
  { editingUser: { uid: "another-admin", role: "admin" }, userRole: "admin", lockRole: true },
  { userProfile: { uid: "manager-1", role: "manager" }, lockRole: true },
  { lockRole: true },
])("locks role editing when authorization or an explicit lock requires it: %j", override => {
  render((((<UserFormModal {...props} {...override} /> as unknown as Parameters<typeof render>[0])) as unknown as Parameters<typeof render>[0]));
  expect((screen.getByLabelText("Vai trò") as HTMLSelectElement).disabled).toBe(true);
});
