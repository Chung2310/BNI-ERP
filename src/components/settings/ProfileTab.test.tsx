// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ProfileTab from "./ProfileTab";
import { authService } from "../../services/authService";

const auth = vi.hoisted(() => ({ userProfile: null, updateProfileInfo: vi.fn() }));
vi.mock("../../services/authService", () => ({ authService: { uploadManagedFile: vi.fn() } }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("../../pages/Toast", () => ({ toast: { error: vi.fn() } }));

beforeEach(() => {
  auth.userProfile = {
    uid: "member-1", displayName: "Nguyễn An", email: "an@example.com", role: "user",
    phone: "0901234567", birthDate: "1990-05-20T00:00:00.000Z",
    companyName: "Công ty An", industry: "Công nghệ", photoURL: "/avatar.png",
  };
  auth.updateProfileInfo.mockReset().mockResolvedValue(undefined);
  vi.mocked(authService.uploadManagedFile).mockReset().mockResolvedValue({ url: "/new-cover.png", uploadToken: "cover-token" });
});
afterEach(cleanup);

it("saves personal and business fields with a date-only birthday and no account privileges", async () => {
  render(<ProfileTab />);
  fireEvent.change(screen.getByLabelText("Họ và Tên *"), { target: { value: "  Nguyễn Bình  " } });
  fireEvent.change(screen.getByLabelText("Địa chỉ Email *"), { target: { value: "  BINH@EXAMPLE.COM  " } });
  fireEvent.change(screen.getByLabelText("Số điện thoại"), { target: { value: "0912345678" } });
  fireEvent.change(screen.getByLabelText("Tên doanh nghiệp"), { target: { value: "  Công ty Bình  " } });
  fireEvent.change(screen.getByLabelText("Ngành nghề"), { target: { value: "  Dịch vụ  " } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
  await waitFor(() => expect(auth.updateProfileInfo).toHaveBeenCalledWith("Nguyễn Bình", "/avatar.png", {
    email: "binh@example.com", phone: "0912345678", companyName: "Công ty Bình", industry: "Dịch vụ", birthDate: "1990-05-20", coverImage: "",
  }));
});

it("allows clearing optional information and restoring the saved profile", async () => {
  render(<ProfileTab />);
  fireEvent.change(screen.getByLabelText("Số điện thoại"), { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "Hủy thay đổi" }));
  expect((screen.getByLabelText("Số điện thoại") as HTMLInputElement).value).toBe("0901234567");
  fireEvent.change(screen.getByLabelText("Số điện thoại"), { target: { value: "" } });
  fireEvent.change(screen.getByLabelText("Tên doanh nghiệp"), { target: { value: "" } });
  fireEvent.change(screen.getByLabelText("Ngành nghề"), { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "Xóa ngày đã chọn" }));
  fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
  await waitFor(() => expect(auth.updateProfileInfo).toHaveBeenCalledWith("Nguyễn An", "/avatar.png", {
    email: "an@example.com", phone: "", companyName: "", industry: "", birthDate: "", coverImage: "",
  }));
});

it("initializes when the profile loads and discards drafts when the signed-in member changes", () => {
  const first = auth.userProfile;
  auth.userProfile = null;
  const view = render(<ProfileTab />);
  expect(screen.queryByLabelText("Họ và Tên *")).toBeNull();
  auth.userProfile = first;
  view.rerender(<ProfileTab />);
  fireEvent.change(screen.getByLabelText("Số điện thoại"), { target: { value: "draft" } });
  auth.userProfile = { ...first, uid: "member-2", displayName: "Thành viên khác", phone: "0987654321" };
  view.rerender(<ProfileTab />);
  expect((screen.getByLabelText("Họ và Tên *") as HTMLInputElement).value).toBe("Thành viên khác");
  expect((screen.getByLabelText("Số điện thoại") as HTMLInputElement).value).toBe("0987654321");
});

it("retains edits after a failed save and permits retry", async () => {
  auth.updateProfileInfo.mockRejectedValueOnce(new Error("Network error"));
  render(<ProfileTab />);
  fireEvent.change(screen.getByLabelText("Ngành nghề"), { target: { value: "Giáo dục" } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
  await waitFor(() => expect((screen.getByRole("button", { name: "Lưu thay đổi" }) as HTMLButtonElement).disabled).toBe(false));
  expect((screen.getByLabelText("Ngành nghề") as HTMLInputElement).value).toBe("Giáo dục");
  fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
  await waitFor(() => expect(auth.updateProfileInfo).toHaveBeenCalledTimes(2));
});

it("rejects blank names and future birthdays before saving", () => {
  const view = render(<ProfileTab />);
  fireEvent.change(screen.getByLabelText("Họ và Tên *"), { target: { value: "   " } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
  expect(auth.updateProfileInfo).not.toHaveBeenCalled();
  auth.userProfile = { ...auth.userProfile, uid: "member-future", birthDate: "2999-01-01" };
  view.rerender(<ProfileTab />);
  fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
  expect(auth.updateProfileInfo).not.toHaveBeenCalled();
});

it("rejects an invalid email before saving", () => {
  render(<ProfileTab />);
  fireEvent.change(screen.getByLabelText("Địa chỉ Email *"), { target: { value: "email-khong-hop-le" } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
  expect(auth.updateProfileInfo).not.toHaveBeenCalled();
});

it("previews an uploaded cover and saves it with its managed upload token", async () => {
  auth.userProfile.coverImage = "/old-cover.png";
  auth.userProfile.companyCode = "BNI";
  render(<ProfileTab />);
  expect(screen.getByAltText("Ảnh bìa hồ sơ").getAttribute("src")).toBe("/old-cover.png");
  const file = new File(["image"], "cover.png", { type: "image/png" });
  fireEvent.change(screen.getByLabelText("Chọn ảnh bìa"), { target: { files: [file] } });
  expect((screen.getByRole("button", { name: "Lưu thay đổi" }) as HTMLButtonElement).disabled).toBe(true);
  await waitFor(() => expect(screen.getByAltText("Ảnh bìa hồ sơ").getAttribute("src")).toBe("/new-cover.png"));
  expect(authService.uploadManagedFile).toHaveBeenCalledWith(file, "profile.cover", "BNI");
  expect(auth.updateProfileInfo).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
  await waitFor(() => expect(auth.updateProfileInfo).toHaveBeenCalledWith("Nguyễn An", "/avatar.png", expect.objectContaining({ coverImage: "/new-cover.png", coverUploadToken: "cover-token" })));
});

it("cancels a cover upload and allows saving cover removal", async () => {
  auth.userProfile.coverImage = "/old-cover.png";
  render(<ProfileTab />);
  fireEvent.change(screen.getByLabelText("Chọn ảnh bìa"), { target: { files: [new File(["image"], "cover.png", { type: "image/png" })] } });
  await waitFor(() => expect(screen.getByAltText("Ảnh bìa hồ sơ").getAttribute("src")).toBe("/new-cover.png"));
  fireEvent.click(screen.getByRole("button", { name: "Hủy thay đổi" }));
  expect(screen.getByAltText("Ảnh bìa hồ sơ").getAttribute("src")).toBe("/old-cover.png");
  fireEvent.click(screen.getByRole("button", { name: "Xóa ảnh bìa" }));
  expect(screen.queryByAltText("Ảnh bìa hồ sơ")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
  await waitFor(() => expect(auth.updateProfileInfo).toHaveBeenCalled());
  const details = auth.updateProfileInfo.mock.calls[0][2];
  expect(details.coverImage).toBe("");
  expect(details).not.toHaveProperty("coverUploadToken");
});

it("rejects non-images and oversized covers before uploading", () => {
  render(<ProfileTab />);
  const input = screen.getByLabelText("Chọn ảnh bìa");
  fireEvent.change(input, { target: { files: [new File(["text"], "notes.txt", { type: "text/plain" })] } });
  const oversized = new File(["image"], "cover.png", { type: "image/png" });
  Object.defineProperty(oversized, "size", { value: 5 * 1024 * 1024 + 1 });
  fireEvent.change(input, { target: { files: [oversized] } });
  expect(authService.uploadManagedFile).not.toHaveBeenCalled();
});

it("keeps the original cover when uploading fails and unlocks saving", async () => {
  auth.userProfile.coverImage = "/old-cover.png";
  vi.mocked(authService.uploadManagedFile).mockRejectedValueOnce(new Error("Upload failed"));
  render(<ProfileTab />);
  fireEvent.change(screen.getByLabelText("Chọn ảnh bìa"), { target: { files: [new File(["image"], "cover.png", { type: "image/png" })] } });
  await waitFor(() => expect((screen.getByRole("button", { name: "Lưu thay đổi" }) as HTMLButtonElement).disabled).toBe(false));
  expect(screen.getByAltText("Ảnh bìa hồ sơ").getAttribute("src")).toBe("/old-cover.png");
});
