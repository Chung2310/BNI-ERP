import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Building2,
  Plus,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Inbox,
  Check,
  X,
  UserPlus,
  UserMinus,
  ShieldCheck,
  CheckCircle,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getAccessToken } from "../services/authService";

type Chapter = {
  code: string;
  name: string;
  chapterRegion?: string;
  chapterAddress?: string;
  acceptsApplications?: boolean;
  ownerEmail?: string;
};

type Application = {
  _id: string;
  chapterCode: string;
  status: string;
  decisionReason?: string;
  createdAt: string;
  profileSnapshot?: {
    displayName?: string;
    email?: string;
    phone?: string;
    companyName?: string;
    industry?: string;
    photoURL?: string;
    referral?: string;
    note?: string;
  };
};

type LeaveRequest = {
  _id: string;
  chapterCode: string;
  status: string;
  reason?: string;
  decisionReason?: string;
  createdAt: string;
  userId?: string | { displayName?: string; email?: string; photoURL?: string; phone?: string };
};

async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(`/api/v1/chapters${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${getAccessToken()}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || "Không thể xử lý yêu cầu.");
  return result.data as T;
}

export default function ChapterPortal() {
  const { userProfile, refreshProfile, superadminActiveChapter, setSuperadminActiveChapter } = useAuth();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Modals & form state
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [newChapter, setNewChapter] = useState({
    code: "",
    name: "",
    region: "",
    address: "",
    adminName: "",
    adminEmail: "",
    adminPassword: "",
  });

  const [leaveReason, setLeaveReason] = useState("");

  const role = userProfile?.role;
  const isSuperadmin = role === "superadmin";
  const isAdmin = role === "admin";

  const effectiveChapterCode = isSuperadmin ? (superadminActiveChapter || "") : (userProfile?.companyCode || "");

  const reload = useCallback(async () => {
    if (!userProfile) return;
    try {
      const jobs: Promise<unknown>[] = [
        api<Chapter[]>(isSuperadmin ? "/manage" : "/").then(setChapters),
      ];

      if (isSuperadmin && effectiveChapterCode) {
        jobs.push(
          api<{ applications: Application[]; leaves: LeaveRequest[] }>(
            `/manage/${encodeURIComponent(effectiveChapterCode)}/overview`
          ).then((data) => {
            setApplications(data.applications || []);
            setLeaves(data.leaves || []);
          })
        );
      } else if (isAdmin) {
        jobs.push(api<Application[]>("/admin/applications").then(setApplications));
        jobs.push(api<LeaveRequest[]>("/admin/leave-requests").then(setLeaves));
      } else if (userProfile.companyCode && !isSuperadmin) {
        jobs.push(api<LeaveRequest[]>("/me/leave-requests").then(setLeaves));
      }

      await Promise.all(jobs);
    } catch (e) {
      console.error("Lỗi khi tải dữ liệu ChapterPortal:", e);
    }
  }, [isAdmin, isSuperadmin, userProfile, effectiveChapterCode]);

  useEffect(() => {
    void reload().catch((reason) => setError(reason.message));
  }, [reload]);

  async function act(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      await reload();
      await refreshProfile();
      setMessage(success);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể xử lý yêu cầu.");
    } finally {
      setBusy(false);
    }
  }

  // Chỉ admin chapter được xác nhận đơn.
  function decideApplication(id: string) {
    void act(
      () =>
        api(`/admin/applications/${id}/decision`, "POST", {
          decision: "approved",
          chapterCode: effectiveChapterCode,
        }),
      "Đã xác nhận và duyệt thành viên vào Chapter."
    );
  }

  // Phê duyệt rời chapter
  function decideLeave(id: string) {
    void act(
      () =>
        api(`/admin/leave-requests/${id}/decision`, "POST", {
          decision: "approved",
          chapterCode: effectiveChapterCode,
        }),
      "Đã xác nhận thành viên rời Chapter."
    );
  }

  // Tạo chapter mới
  async function createChapter(event: FormEvent) {
    event.preventDefault();
    await act(
      () => api("/manage", "POST", newChapter),
      `Đã tạo thành công Chapter ${newChapter.name} (${newChapter.code}).`
    );
    setNewChapter({
      code: "",
      name: "",
      region: "",
      address: "",
      adminName: "",
      adminEmail: "",
      adminPassword: "",
    });
    setShowCreateModal(false);
  }

  return (
    <div className="space-y-6">
      {/* 1. TIÊU ĐỀ TRANG */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="h-7 w-1.5 shrink-0 rounded-full bg-red-600" />
          <div>
            <h1 className="font-extrabold text-xl tracking-tight text-slate-900 md:text-2xl">
              {isSuperadmin ? "Quản lý hệ thống Chapter" : "Chapter của tôi"}
            </h1>
            <p className="text-xs font-medium text-slate-500">
              {isSuperadmin
                ? "Tạo Chapter mới và xem dữ liệu các Chapter BNI"
                : `Quản lý thành viên và hoạt động Chapter ${userProfile?.companyCode || ""}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isSuperadmin && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-sky-700 active:scale-95"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Tạo Chapter mới</span>
            </button>
          )}

          <button
            onClick={() => void reload()}
            disabled={busy}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 disabled:opacity-50"
            title="Làm mới dữ liệu từ máy chủ"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin text-sky-600" : "text-slate-400"}`} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* 2. ALERTS */}
      {error && (
        <div
          role="alert"
          className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError("")} className="cursor-pointer text-red-400 hover:text-red-700">
            ✕
          </button>
        </div>
      )}

      {message && (
        <div
          role="status"
          className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
            <span>{message}</span>
          </div>
          <button onClick={() => setMessage("")} className="cursor-pointer text-emerald-400 hover:text-emerald-700">
            ✕
          </button>
        </div>
      )}

      {/* 3. SUPERADMIN: TẠO CHAPTER VÀ XEM DỮ LIỆU CHAPTER ĐÃ CHỌN */}
      {isSuperadmin && (
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
                  <Building2 className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Danh sách Chapter ({chapters.length})
                  </h2>
                  <p className="text-xs text-slate-500">
                    Bấm &quot;Xem trên ERP&quot; để chọn Chapter đó vào bộ lọc Header và xem toàn bộ biểu đồ, danh sách
                  </p>
                </div>
              </div>

              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                {chapters.length} chi nhánh
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {chapters.map((ch) => {
                const isAccepting = ch.acceptsApplications !== false;
                const isCurrentlyActive = superadminActiveChapter === ch.code;

                return (
                  <div
                    key={ch.code}
                    className={`flex flex-col justify-between rounded-xl border p-4 shadow-2xs transition-all ${
                      isCurrentlyActive
                        ? "border-sky-500 bg-sky-50/20 ring-2 ring-sky-500/20"
                        : "border-slate-200/80 bg-white hover:border-sky-300"
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h3 className="font-bold text-sm text-slate-900">{ch.name}</h3>
                            {isCurrentlyActive && (
                              <span className="rounded-md bg-sky-600 px-1.5 py-0.2 text-[10px] font-bold text-white">
                                Đang xem
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-xs font-semibold text-slate-500">
                            {ch.code}
                          </span>
                        </div>

                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                            isAccepting
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-slate-100 text-slate-500 border-slate-200"
                          }`}
                        >
                          {isAccepting ? "Nhận đơn" : "Tạm ngưng"}
                        </span>
                      </div>

                      <div className="mt-3 space-y-1 text-xs text-slate-600">
                        <p>
                          <span className="text-slate-400">Khu vực:</span>{" "}
                          <span className="font-medium text-slate-800">{ch.chapterRegion || "Toàn quốc"}</span>
                        </p>
                        {ch.chapterAddress && (
                          <p className="truncate">
                            <span className="text-slate-400">Địa chỉ:</span> {ch.chapterAddress}
                          </p>
                        )}
                        {ch.ownerEmail && (
                          <p className="truncate">
                            <span className="text-slate-400">Admin:</span> {ch.ownerEmail}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSuperadminActiveChapter?.(ch.code);
                            window.dispatchEvent(new Event("focus"));
                          }}
                          className={`inline-flex cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                            isCurrentlyActive
                              ? "bg-sky-600 text-white"
                              : "bg-sky-50 text-sky-700 hover:bg-sky-100"
                          }`}
                        >
                          <span>{isCurrentlyActive ? "Đang chọn" : "Xem trên ERP"}</span>
                          <ExternalLink className="h-3 w-3" />
                        </button>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Superadmin chỉ xem đơn của chapter đang chọn. */}
          {superadminActiveChapter && (
            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs sm:p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <UserPlus className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">
                      Đơn gia nhập chờ xác nhận · Chapter {superadminActiveChapter}
                    </h2>
                    <p className="text-xs text-slate-500">
                      Chỉ xem các đơn gia nhập của Chapter đang chọn ở Header
                    </p>
                  </div>
                </div>

                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                  {applications.length} đơn chờ
                </span>
              </div>

              {applications.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  <Inbox className="h-7 w-7 mx-auto mb-2 text-slate-300" />
                  Chapter {superadminActiveChapter} hiện không có đơn xin gia nhập nào đang chờ duyệt.
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {applications.map((application) => {
                    const snap = application.profileSnapshot;
                    return (
                      <div
                        key={application._id}
                        className="flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs"
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="text-sm font-bold text-slate-900">
                                {snap?.displayName || "Ứng viên"}
                              </h3>
                              <p className="text-xs text-slate-500">{snap?.email}</p>
                            </div>
                            <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                              Chờ duyệt
                            </span>
                          </div>

                          <div className="space-y-1 text-xs text-slate-600 rounded-lg bg-slate-50 p-2.5">
                            {snap?.phone && <p>SĐT: <span className="font-medium text-slate-800">{snap.phone}</span></p>}
                            {snap?.companyName && <p>Công ty: <span className="font-medium text-slate-800">{snap.companyName}</span></p>}
                            {snap?.industry && <p>Ngành nghề: <span>{snap.industry}</span></p>}
                            {snap?.referral && <p>Người giới thiệu: <span className="text-slate-700">{snap.referral}</span></p>}
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {/* 4. DÀNH CHO CHAPTER ADMIN: DUYỆT ĐƠN & YÊU CẦU RỜI CỦA CHAPTER MÌNH */}
      {isAdmin && (
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
                  <UserPlus className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Đơn gia nhập chờ duyệt · Chapter {userProfile?.companyCode}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Danh sách các ứng viên đăng ký tham gia Chapter của bạn
                  </p>
                </div>
              </div>

              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                {applications.length} đơn
              </span>
            </div>

            {applications.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">
                <Inbox className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                Hiện không có đơn xin gia nhập nào đang chờ xác nhận.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {applications.map((application) => {
                  const snap = application.profileSnapshot;
                  return (
                    <div
                      key={application._id}
                      className="flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="text-sm font-bold text-slate-900">{snap?.displayName || "Ứng viên"}</h3>
                            <p className="text-xs text-slate-500">{snap?.email}</p>
                          </div>
                          <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                            Chờ duyệt
                          </span>
                        </div>

                        <div className="space-y-1 text-xs text-slate-600 rounded-lg bg-slate-50 p-2.5">
                          {snap?.phone && <p>SĐT: <span className="font-medium text-slate-800">{snap.phone}</span></p>}
                          {snap?.companyName && <p>Công ty: <span className="font-medium text-slate-800">{snap.companyName}</span></p>}
                          {snap?.industry && <p>Ngành nghề: <span>{snap.industry}</span></p>}
                        </div>
                      </div>

                      <div className="mt-3 flex justify-end border-t border-slate-100 pt-3">
                        <button
                          disabled={busy}
                          onClick={() => decideApplication(application._id)}
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>Xác nhận duyệt</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                  <UserMinus className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Yêu cầu rời Chapter
                  </h2>
                  <p className="text-xs text-slate-500">
                    Thành viên xin rút khỏi Chapter {userProfile?.companyCode}
                  </p>
                </div>
              </div>

              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                {leaves.length} yêu cầu
              </span>
            </div>

            {leaves.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                Không có yêu cầu rời Chapter nào đang chờ xử lý.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {leaves.map((req) => {
                  const memberName = typeof req.userId === "object" ? req.userId?.displayName : "Thành viên";
                  return (
                    <div
                      key={req._id}
                      className="flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs"
                    >
                      <div className="space-y-2">
                        <h3 className="text-sm font-bold text-slate-900">{memberName}</h3>
                        {req.reason && <p className="text-xs italic text-slate-600 bg-rose-50 p-2 rounded-lg">Lý do: {req.reason}</p>}
                      </div>
                      <div className="mt-3 flex justify-end border-t border-slate-100 pt-3">
                        <button
                          disabled={busy}
                          onClick={() => decideLeave(req._id)}
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-rose-700 active:scale-95 disabled:opacity-50"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>Xác nhận cho rời</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* 5. DÀNH CHO THÀNH VIÊN THƯỜNG */}
      {userProfile?.companyCode && !isAdmin && !isSuperadmin && (
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs sm:p-6">
          <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Chapter đang sinh hoạt: {userProfile.companyCode}
                </h2>
                <p className="text-xs text-slate-500">
                  Tư cách thành viên chính thức
                </p>
              </div>
            </div>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
              Đang hoạt động
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Lý do xin rời Chapter
                <textarea
                  rows={3}
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  placeholder="Vui lòng cung cấp lý do..."
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs text-slate-800 focus:border-rose-500 focus:bg-white focus:outline-hidden"
                />
              </label>

              <div className="mt-3 flex justify-end">
                <button
                  disabled={busy || !leaveReason.trim()}
                  onClick={() =>
                    void act(
                      () => api("/me/leave-requests", "POST", { reason: leaveReason }),
                      "Đã gửi yêu cầu rời Chapter."
                    )
                  }
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-rose-700 active:scale-95 disabled:opacity-50"
                >
                  <UserMinus className="h-3.5 w-3.5" />
                  <span>Gửi yêu cầu rời Chapter</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* MODAL TẠO CHAPTER MỚI */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
                  <Building2 className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Khởi tạo Chapter mới & Cấp tài khoản Admin
                  </h2>
                  <p className="text-xs text-slate-500">
                    Tạo mã chapter mới và thiết lập tài khoản Admin quản lý ban đầu
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={createChapter} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                {([
                  ["code", "Mã Chapter (VD: BNI_HANOI)", "text"],
                  ["name", "Tên Chapter (VD: BNI Dynamic)", "text"],
                  ["region", "Khu vực / Tỉnh thành", "text"],
                  ["address", "Địa chỉ sinh hoạt định kỳ", "text"],
                  ["adminName", "Họ tên Admin Chapter", "text"],
                  ["adminEmail", "Email đăng nhập Admin", "email"],
                  ["adminPassword", "Mật khẩu Admin ban đầu", "password"],
                ] as const).map(([key, labelText, inputType]) => (
                  <label key={key} className="text-xs font-medium text-slate-700">
                    {labelText} {!["region", "address"].includes(key) && <span className="text-rose-500">*</span>}
                    <input
                      required={!["region", "address"].includes(key)}
                      type={inputType}
                      value={newChapter[key]}
                      onChange={(e) =>
                        setNewChapter((curr) => ({ ...curr, [key]: e.target.value }))
                      }
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-800 focus:border-sky-500 focus:bg-white focus:outline-hidden"
                    />
                  </label>
                ))}
              </div>

              <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-sky-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-sky-700 active:scale-95 disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  <span>Xác nhận tạo Chapter</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
