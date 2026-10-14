import React, { useState } from "react";
import { Trash2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { toast } from "../../pages/Toast";
import { authService } from "../../services/authService";

export default function DeleteAccountCard() {
  const { userProfile, deleteOwnAccount } = useAuth();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [options, setOptions] = useState<Awaited<ReturnType<typeof authService.accountDeletionOptions>> | null>(null);
  const [successorId, setSuccessorId] = useState("");
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [optionsError, setOptionsError] = useState("");
  if (!userProfile) return null;
  const loadOptions = async () => {
    setOpen(true); setLoadingOptions(true); setOptionsError("");
    try { setOptions(await authService.accountDeletionOptions()); }
    catch (error) { setOptionsError(error instanceof Error ? error.message : "Không thể tải thông tin xóa tài khoản."); }
    finally { setLoadingOptions(false); }
  };

  const cancel = () => { setOpen(false); setPassword(""); setConfirmation(""); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (deleting || !options || !password || confirmation !== "XÓA TÀI KHOẢN" || (options.requiresTransfer && !successorId)) return;
    setDeleting(true);
    try {
      await deleteOwnAccount(password, confirmation, successorId || undefined);
      window.location.assign("/user-data-deletion");
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
        <>
          <p className="mb-4 text-sm text-gray-600">Xóa hồ sơ, ảnh cá nhân, tin nhắn và tệp bạn gửi/tải lên, đơn gia nhập/rời Chapter, đăng ký thông báo và lịch sử hoạt động. Danh tính trong cuộc họp và trò chơi sẽ được gỡ bỏ. Cuộc họp, nội dung của người khác và số liệu thu chi đã loại bỏ danh tính vẫn được giữ; bản sao do người nhận tải xuống không thể thu hồi.</p>
          <p className="mb-4 text-sm text-gray-600">Bạn sẽ đăng xuất khi yêu cầu được tiếp nhận. Không thể hủy thao tác. Xử lý thông thường mất vài phút; hệ thống tự thử lại khi dịch vụ lưu trữ gặp lỗi. Có thể theo dõi trạng thái mà không cần đăng nhập.</p>
          {!open ? (
            <button type="button" onClick={() => void loadOptions()} className="rounded-xl border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">Xóa tài khoản của tôi</button>
          ) : (
            <form onSubmit={submit} className="space-y-4" aria-busy={deleting}>
              <p className="text-sm font-semibold text-gray-700">Tài khoản sẽ xóa: {userProfile.email}</p>
              {loadingOptions ? <p role="status">Đang tải thông tin...</p> : null}
              {optionsError ? <div role="alert"><p>{optionsError}</p><button type="button" onClick={() => void loadOptions()}>Thử lại</button></div> : null}
              {options?.requiresTransfer ? <div><label htmlFor="delete-account-successor" className="mb-1 block text-sm font-medium">Chọn người nhận quyền quản trị Chapter</label><select id="delete-account-successor" required disabled={deleting} value={successorId} onChange={(event) => setSuccessorId(event.target.value)} className="w-full rounded-xl border border-gray-300 p-3 text-sm"><option value="">Chọn thành viên</option>{options.successors.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select><p className="mt-2 text-sm text-gray-600">Người được chọn sẽ trở thành quản trị viên Chapter.</p></div> : null}
              {options?.archivesChapter ? <p className="text-sm text-gray-600">Chapter không còn thành viên đang hoạt động khác và sẽ được lưu trữ.</p> : null}
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
                <button type="submit" disabled={deleting || !options || !password || confirmation !== "XÓA TÀI KHOẢN" || (options.requiresTransfer && !successorId)} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{deleting ? "Đang gửi..." : "Xóa vĩnh viễn tài khoản"}</button>
              </div>
            </form>
          )}
        </>
    </section>
  );
}
