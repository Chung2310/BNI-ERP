import bcrypt from "bcryptjs";

export async function verifySelfAccountDeletion(user: { role: string; password?: string } | null, password: string, confirmation: string): Promise<void> {
  if (!user) throw new Error("Không tìm thấy tài khoản.");
  if (user.role === "admin") throw new Error("Tài khoản quản trị viên không thể tự xóa. Vui lòng liên hệ quản trị viên hệ thống.");
  if (confirmation !== "XÓA TÀI KHOẢN") throw new Error("Vui lòng nhập chính xác XÓA TÀI KHOẢN để xác nhận.");
  if (!user.password) throw new Error("Vui lòng thiết lập mật khẩu trong phần Bảo mật trước khi xóa tài khoản.");
  if (!password || !(await bcrypt.compare(password, user.password))) throw new Error("Mật khẩu hiện tại không chính xác.");
}