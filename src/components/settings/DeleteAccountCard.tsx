import React, { useState } from "react";
import { Trash2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { toast } from "../../pages/Toast";

export default function DeleteAccountCard() {
  const { userProfile, deleteOwnAccount } = useAuth();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  if (!userProfile) return null;
  const isAdmin = userProfile.role === "admin";

  const cancel = () => { setOpen(false); setPassword(""); setConfirmation(""); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (deleting || isAdmin || !password || confirmation !== "XÓA TÀI KHOẢN") return;
    setDeleting(true);
    try {
      await deleteOwnAccount(password, confirmation);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể xóa tài khoản.");
      setPassword("");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-red-200 bg-white p-6 shadow-xs" aria-labelledby="delete-account-title">
      <h3 id="delete-account-title" className="mb-3 flex items-center gap-2 text-base font-bold text-red-700"><Trash2 className="h-5 w-5" />Xóa tài khoản của tôi</h3>
      {isAdmin ? (
        <p className="text-sm text-gray-600">Tài khoản quản trị viên không thể tự xóa. Vui lòng liên hệ quản trị viên hệ thống.</p>
      ) : (
        <>
          <p className="mb-4 text-sm text-gray-600">Xóa tài khoản sẽ kết thúc phiên đăng nhập và bạn không thể dùng lại tài khoản này. Thao tác không thể hoàn tác. Dữ liệu dùng chung như tin nhắn và lịch sử hoạt động vẫn được giữ lại.</p>
          {!open ? (
            <button type="button" onClick={() => setOpen(true)} className="rounded-xl border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">Xóa tài khoản của tôi</button>
          ) : (
            <form onSubmit={submit} className="space-y-4" aria-busy={deleting}>
              <p className="text-sm font-semibold text-gray-700">Tài khoản sẽ xóa: {userProfile.email}</p>
              <div>
                <label htmlFor="delete-account-password" className="mb-1 block text-sm font-medium">Mật khẩu hiện tại</label>
                <input id="delete-account-password" type="password" autoComplete="current-password" required disabled={deleting}
                  value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-gray-300 p-3 text-sm" />
              </div>
              <div>
                <label htmlFor="delete-account-confirmation" className="mb-1 block text-sm font-medium">Nhập XÓA TÀI KHOẢN để xác nhận</label>
                <input id="delete-account-confirmation" autoComplete="off" required disabled={deleting}
                  value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="w-full rounded-xl border border-gray-300 p-3 text-sm" />
              </div>
              <div className="flex flex-wrap justify-end gap-3">
                <button type="button" disabled={deleting} onClick={cancel} className="rounded-xl border border-gray-300 px-4 py-2 text-sm disabled:opacity-50">Hủy</button>
                <button type="submit" disabled={deleting || !password || confirmation !== "XÓA TÀI KHOẢN"} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{deleting ? "Đang xóa..." : "Xóa vĩnh viễn tài khoản"}</button>
              </div>
            </form>
          )}
        </>
      )}
    </section>
  );
}