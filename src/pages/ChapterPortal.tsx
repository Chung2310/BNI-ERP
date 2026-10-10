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
  Search,
  MapPin,
  UserRound,
  Clock,
  ArrowRight,
  ChevronRight,
  Users,
  Calendar,
  Filter,
  Compass,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getAccessToken } from "../services/authService";
import { VIETNAM_PROVINCES, VIETNAM_PROVINCE_NAMES } from "../config/provinces";

type Chapter = {
  code: string;
  name: string;
  chapterRegion?: string;
  chapterAddress?: string;
  chairpersonName?: string;
  acceptsApplications?: boolean;
  ownerEmail?: string;
};

type ChapterDetail = Chapter & {
  memberCount: number;
  completedMeetingCount: number;
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
  const [directoryLoaded, setDirectoryLoaded] = useState(false);
  const [selectedChapterCode, setSelectedChapterCode] = useState<string | null>(null);
  const [chapterDetail, setChapterDetail] = useState<ChapterDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [search, setSearch] = useState("");
  const [province, setProvince] = useState("");

  // Modals & form state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);

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
  const isApplicant = Boolean(userProfile && !userProfile.companyCode && !isAdmin && !isSuperadmin);
  const pendingApplication = isApplicant ? applications.find(application => application.status === "pending") : undefined;
  const normalize = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
  const cleanPrefix = (value: string) => value.toLowerCase().replace(/^(tinh|thanh pho|tp\.?)\s+/i, "").trim();

  // Danh sách các khu vực hiện có của chapter + bộ 34 tỉnh/thành phố chuẩn
  const chapterRegions = chapters.map(c => c.chapterRegion?.trim()).filter((r): r is string => Boolean(r));
  const provinces = [...new Set([...chapterRegions, ...VIETNAM_PROVINCE_NAMES])].sort((a, b) => a.localeCompare(b, "vi"));

  const matchesProvince = (chapterRegion?: string, selected?: string) => {
    if (!selected) return true;
    if (!chapterRegion) return false;
    const cNorm = normalize(chapterRegion.trim());
    const sNorm = normalize(selected.trim());
    if (cNorm === sNorm) return true;
    const cClean = normalize(cleanPrefix(chapterRegion));
    const sClean = normalize(cleanPrefix(selected));
    return cClean === sClean || cNorm.includes(sClean) || sNorm.includes(cClean);
  };

  const query = normalize(search.trim());
  const visibleChapters = chapters.filter(chapter =>
    matchesProvince(chapter.chapterRegion, province) &&
    (!query || [chapter.name, chapter.code, chapter.chapterRegion, chapter.chapterAddress, chapter.chairpersonName]
      .some(value => normalize(value || "").includes(query)))
  );

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
      } else if (!userProfile.companyCode && !isAdmin && !isSuperadmin) {
        jobs.push(api<Application[]>("/me/applications").then(setApplications));
      } else if (isAdmin) {
        jobs.push(api<Application[]>("/admin/applications").then(setApplications));
        jobs.push(api<LeaveRequest[]>("/admin/leave-requests").then(setLeaves));
      } else if (userProfile.companyCode && !isSuperadmin) {
        jobs.push(api<LeaveRequest[]>("/me/leave-requests").then(setLeaves));
      }

      await Promise.all(jobs).then(() => setDirectoryLoaded(true));
    } catch (e) {
      console.error("Lỗi khi tải dữ liệu ChapterPortal:", e);
      throw e;
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

  async function openChapterDetail(code: string) {
    setSelectedChapterCode(code);
    setChapterDetail(null);
    setDetailError("");
    setDetailLoading(true);
    try {
      setChapterDetail(await api<ChapterDetail>(`/directory/${encodeURIComponent(code)}`));
    } catch (reason) {
      setDetailError(reason instanceof Error ? reason.message : "Không thể tải thông tin chapter.");
    } finally {
      setDetailLoading(false);
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
          {isApplicant ? (
            <Compass className="h-7 w-7 text-sky-600 shrink-0" />
          ) : (
            <Building2 className="h-7 w-7 text-sky-600 shrink-0" />
          )}
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
              {isSuperadmin ? "Quản lý hệ thống Chapter" : isApplicant ? "Tìm Chapter phù hợp" : "Chapter của tôi"}
            </h1>
            <p className="mt-0.5 text-xs text-slate-500 font-medium">
              {isSuperadmin
                ? "Tạo Chapter mới và xem dữ liệu các Chapter BNI"
                : isApplicant
                ? "Khám phá các Chapter BNI đang hoạt động và gửi hồ sơ xin gia nhập"
                : `Quản lý thành viên và hoạt động Chapter ${userProfile?.companyCode || ""}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
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
                <Building2 className="h-5 w-5 text-sky-600 shrink-0" />
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
                  <UserPlus className="h-5 w-5 text-sky-600 shrink-0" />
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
                <div className="overflow-x-auto -mx-5 sm:-mx-6">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200/80 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <th className="py-3 px-5 sm:px-6">Ứng viên</th>
                        <th className="py-3 px-4">Doanh nghiệp / Ngành nghề</th>
                        <th className="py-3 px-4">Số điện thoại</th>
                        <th className="py-3 px-4">Người giới thiệu</th>
                        <th className="py-3 px-5 sm:px-6 text-right">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {applications.map((application) => {
                        const snap = application.profileSnapshot;
                        return (
                          <tr key={application._id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-3.5 px-5 sm:px-6">
                              <div className="font-bold text-slate-900 text-sm">{snap?.displayName || "Ứng viên"}</div>
                              <div className="text-slate-500 text-xs mt-0.5">{snap?.email}</div>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="font-semibold text-slate-800">{snap?.companyName || "Chưa cập nhật"}</div>
                              <div className="text-slate-500 text-xs mt-0.5">{snap?.industry || "—"}</div>
                            </td>
                            <td className="py-3.5 px-4 font-mono text-slate-700">
                              {snap?.phone || "—"}
                            </td>
                            <td className="py-3.5 px-4 text-slate-600">
                              {snap?.referral || "—"}
                            </td>
                            <td className="py-3.5 px-5 sm:px-6 text-right">
                              <span className="inline-flex items-center rounded-full bg-sky-50 border border-sky-200/80 px-2.5 py-0.5 text-[11px] font-semibold text-sky-700">
                                Chờ duyệt
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
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
                <UserPlus className="h-5 w-5 text-sky-600 shrink-0" />
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
              <div className="overflow-x-auto -mx-5 sm:-mx-6">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200/80 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="py-3 px-5 sm:px-6">Ứng viên</th>
                      <th className="py-3 px-4">Doanh nghiệp / Ngành nghề</th>
                      <th className="py-3 px-4">Số điện thoại</th>
                      <th className="py-3 px-4">Trạng thái</th>
                      <th className="py-3 px-5 sm:px-6 text-right">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {applications.map((application) => {
                      const snap = application.profileSnapshot;
                      return (
                        <tr key={application._id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3.5 px-5 sm:px-6">
                            <div className="font-bold text-slate-900 text-sm">{snap?.displayName || "Ứng viên"}</div>
                            <div className="text-slate-500 text-xs mt-0.5">{snap?.email}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-800">{snap?.companyName || "Chưa cập nhật"}</div>
                            <div className="text-slate-500 text-xs mt-0.5">{snap?.industry || "—"}</div>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-700">
                            {snap?.phone || "—"}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center rounded-full bg-sky-50 border border-sky-200/80 px-2.5 py-0.5 text-[11px] font-semibold text-sky-700">
                              Chờ duyệt
                            </span>
                          </td>
                          <td className="py-3.5 px-5 sm:px-6 text-right">
                            <button
                              disabled={busy}
                              onClick={() => decideApplication(application._id)}
                              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-sky-700 active:scale-95 disabled:opacity-50 transition"
                            >
                              <Check className="h-3.5 w-3.5" />
                              <span>Xác nhận duyệt</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <UserMinus className="h-5 w-5 text-slate-600 shrink-0" />
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
              <div className="overflow-x-auto -mx-5 sm:-mx-6">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200/80 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="py-3 px-5 sm:px-6">Thành viên</th>
                      <th className="py-3 px-4">Lý do xin rời</th>
                      <th className="py-3 px-4">Ngày gửi</th>
                      <th className="py-3 px-5 sm:px-6 text-right">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {leaves.map((req) => {
                      const memberName = typeof req.userId === "object" ? req.userId?.displayName : "Thành viên";
                      const memberEmail = typeof req.userId === "object" ? req.userId?.email : "";
                      return (
                        <tr key={req._id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3.5 px-5 sm:px-6">
                            <div className="font-bold text-slate-900 text-sm">{memberName}</div>
                            {memberEmail && <div className="text-slate-500 text-xs mt-0.5">{memberEmail}</div>}
                          </td>
                          <td className="py-3.5 px-4 text-slate-700">
                            {req.reason ? <span className="italic">{req.reason}</span> : <span className="text-slate-400">Không có lý do</span>}
                          </td>
                          <td className="py-3.5 px-4 text-slate-500">
                            {req.createdAt ? new Date(req.createdAt).toLocaleDateString("vi-VN") : "—"}
                          </td>
                          <td className="py-3.5 px-5 sm:px-6 text-right">
                            <button
                              disabled={busy}
                              onClick={() => decideLeave(req._id)}
                              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-rose-700 active:scale-95 disabled:opacity-50 transition"
                            >
                              <Check className="h-3.5 w-3.5" />
                              <span>Xác nhận cho rời</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {/* 5. TÀI KHOẢN CHƯA THUỘC CHAPTER */}
      {isApplicant && (
        <section className="space-y-5">
          {pendingApplication && (
            <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-4 shadow-2xs sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-sky-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-semibold text-sky-800 border border-sky-200/80">
                        <span className="h-1.5 w-1.5 rounded-full bg-sky-600 animate-ping" />
                        Đang chờ xét duyệt
                      </span>
                      <h3 className="font-bold text-sm text-slate-900">
                        Đơn gia nhập: <span className="text-sky-900 font-semibold">{chapters.find(chapter => chapter.code === pendingApplication.chapterCode)?.name || pendingApplication.chapterCode}</span>
                      </h3>
                    </div>
                    <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                      Hồ sơ của bạn đã được gửi tới Ban điều hành Chapter. Bạn có thể chọn chuyển sang chapter khác hoặc rút đơn bất cứ lúc nào trước khi được duyệt.
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2 pl-8 sm:pl-0">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setShowWithdrawConfirm(true)}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-red-600 px-3.5 py-2 text-xs font-semibold text-white shadow-2xs transition hover:bg-red-700 active:scale-95 disabled:opacity-50"
                  >
                    <span>Rút đơn</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs sm:p-5">
            <div className="grid gap-3.5 sm:grid-cols-[minmax(0,1fr)_minmax(13rem,17rem)]">
              <div>
                <label htmlFor="chapter-search" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Tìm kiếm Chapter
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="chapter-search"
                    type="search"
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                    placeholder="Tên, mã, địa điểm hoặc chủ tịch..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-9 text-xs sm:text-sm text-slate-800 outline-none transition focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-500/10 placeholder:text-slate-400"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="province-filter" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Tỉnh / Thành phố
                </label>
                <div className="relative">
                  <Filter className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <select
                    id="province-filter"
                    value={province}
                    onChange={event => setProvince(event.target.value)}
                    className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-9 text-xs sm:text-sm font-medium text-slate-800 outline-none transition focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-500/10 cursor-pointer"
                  >
                    <option value="">Tất cả tỉnh / thành phố ({provinces.length})</option>
                    {provinces.map(region => (
                      <option key={region} value={region}>
                        {region}
                      </option>
                    ))}
                  </select>
                  <ChevronRight className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 rotate-90 text-slate-400" />
                </div>
              </div>
            </div>

            {(search || province) && (
              <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
                <span>Đang lọc theo:</span>
                {search && (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-sky-50 px-2 py-1 font-medium text-sky-700">
                    Từ khóa: &ldquo;{search}&rdquo;
                    <button onClick={() => setSearch("")} className="cursor-pointer hover:text-sky-900">✕</button>
                  </span>
                )}
                {province && (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-sky-50 px-2 py-1 font-medium text-sky-700">
                    Khu vực: {province}
                    <button onClick={() => setProvince("")} className="cursor-pointer hover:text-sky-900">✕</button>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => { setSearch(""); setProvince(""); }}
                  className="ml-auto font-semibold text-slate-600 hover:text-sky-700 underline cursor-pointer"
                >
                  Xóa tất cả bộ lọc
                </button>
              </div>
            )}
          </div>

          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
                <span>Danh sách Chapter</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">
                  {visibleChapters.length}
                </span>
              </h2>
            </div>

            {!directoryLoaded && !error ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200/80 bg-white py-12 text-center">
                <RefreshCw className="h-6 w-6 animate-spin text-sky-600 mb-2" />
                <p className="text-sm font-medium text-slate-600">Đang tải danh sách Chapter...</p>
              </div>
            ) : visibleChapters.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200/80 bg-white py-12 text-center text-slate-500">
                <Inbox className="h-9 w-9 text-slate-300 mb-2" />
                <p className="text-sm font-semibold text-slate-700">Không tìm thấy Chapter phù hợp</p>
                <p className="text-xs text-slate-400 mt-1">Hãy thử tìm với từ khóa hoặc khu vực khác.</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {visibleChapters.map(chapter => {
                  const selected = pendingApplication?.chapterCode === chapter.code;

                  return (
                    <article
                      key={chapter.code}
                      className={`group relative flex flex-col justify-between rounded-2xl border bg-white p-5 shadow-xs transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 ${
                        selected
                          ? "border-sky-500 ring-2 ring-sky-500/15 bg-sky-50/20"
                          : "border-slate-200/80 hover:border-sky-300"
                      }`}
                    >
                      <div>
                        {/* Top: Bare icon + Title + Badges */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <Building2 className="h-5 w-5 text-sky-600 shrink-0 mt-0.5" />
                            <div className="min-w-0">
                              <h3 className="text-base font-bold text-slate-900 group-hover:text-sky-600 transition-colors line-clamp-1">
                                {chapter.name}
                              </h3>
                              <span className="inline-block font-mono text-[11px] font-semibold text-slate-500 mt-0.5">
                                {chapter.code}
                              </span>
                            </div>
                          </div>

                          {selected ? (
                            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-semibold text-sky-800 border border-sky-200/80">
                              <span className="h-1.5 w-1.5 rounded-full bg-sky-600" />
                              Đã nộp đơn
                            </span>
                          ) : chapter.chapterRegion ? (
                            <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                              {chapter.chapterRegion}
                            </span>
                          ) : null}
                        </div>

                        {/* Meta info: Clean bare icons without box backgrounds */}
                        <div className="mt-4 space-y-2 text-xs text-slate-600">
                          <div className="flex items-start gap-2">
                            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                            <span className="line-clamp-2">
                              {[chapter.chapterAddress, chapter.chapterRegion].filter(Boolean).join(", ") || "Chưa cập nhật địa điểm"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <UserRound className="h-4 w-4 shrink-0 text-slate-400" />
                            <span className="truncate">
                              Chủ tịch: {chapter.chairpersonName || "Chưa cập nhật"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action Button */}
                      <div className="mt-5 border-t border-slate-100 pt-4">
                        <button
                          type="button"
                          onClick={() => void openChapterDetail(chapter.code)}
                          className={`w-full inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all active:scale-[0.98] ${
                            selected
                              ? "bg-sky-50 border border-sky-200 text-sky-700 hover:bg-sky-100 hover:border-sky-300"
                              : "bg-sky-600 text-white hover:bg-sky-700 shadow-2xs"
                          }`}
                        >
                          <span>{selected ? "Xem đơn & chi tiết Chapter" : "Xem chi tiết Chapter"}</span>
                          {selected ? <ChevronRight className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {isApplicant && selectedChapterCode && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fade-in"
          role="presentation"
          onClick={() => setSelectedChapterCode(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Chi tiết Chapter"
            onClick={event => event.stopPropagation()}
            className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl sm:p-7 border border-slate-100 transform transition-all"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-start gap-3">
                <Building2 className="h-7 w-7 text-sky-600 shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-lg font-bold text-slate-900 sm:text-xl">
                    {chapterDetail?.name || chapters.find(chapter => chapter.code === selectedChapterCode)?.name || "Chi tiết Chapter"}
                  </h2>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-slate-500">
                      Mã: {selectedChapterCode}
                    </span>
                    {pendingApplication?.chapterCode === selectedChapterCode && (
                      <span className="rounded-full bg-sky-100 border border-sky-200 px-2.5 py-0.5 text-[11px] font-semibold text-sky-800">
                        Đang chờ duyệt
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedChapterCode(null)}
                aria-label="Đóng chi tiết Chapter"
                className="cursor-pointer rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {detailLoading && (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <RefreshCw className="h-6 w-6 animate-spin text-sky-600 mb-2" />
                <p className="text-sm font-medium text-slate-600">Đang tải thông tin Chapter...</p>
              </div>
            )}

            {detailError && (
              <div role="alert" className="mt-5 rounded-2xl bg-red-50 p-4 text-xs font-medium text-red-700 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                <span>{detailError}</span>
              </div>
            )}

            {chapterDetail?.code === selectedChapterCode && !detailLoading && (
              <div className="mt-5 space-y-5">
                {/* Stat badges */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-sky-100 bg-sky-50/50 p-4">
                    <div className="flex items-center gap-2 text-sky-700 mb-1">
                      <Users className="h-4 w-4" />
                      <span className="text-xs font-semibold">Thành viên</span>
                    </div>
                    <p className="text-2xl font-black text-sky-900">{chapterDetail.memberCount}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Thành viên chính thức</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4">
                    <div className="flex items-center gap-2 text-slate-700 mb-1">
                      <Calendar className="h-4 w-4 text-sky-600" />
                      <span className="text-xs font-semibold">Buổi họp</span>
                    </div>
                    <p className="text-2xl font-black text-slate-900">{chapterDetail.completedMeetingCount}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Đã tổ chức thành công</p>
                  </div>
                </div>

                {/* Details list */}
                <div className="space-y-2.5 rounded-2xl bg-slate-50/70 border border-slate-100 p-4 text-xs">
                  <div className="flex items-start gap-2.5">
                    <MapPin className="h-4 w-4 shrink-0 text-slate-400 mt-0.5" />
                    <div>
                      <span className="font-bold text-slate-700 block">Địa điểm sinh hoạt</span>
                      <span className="text-slate-600">
                        {[chapterDetail.chapterAddress, chapterDetail.chapterRegion].filter(Boolean).join(", ") || "Chưa cập nhật địa điểm"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 border-t border-slate-200/50 pt-2.5">
                    <UserRound className="h-4 w-4 shrink-0 text-slate-400 mt-0.5" />
                    <div>
                      <span className="font-bold text-slate-700 block">Chủ tịch Chapter</span>
                      <span className="text-slate-600">{chapterDetail.chairpersonName || "Chưa cập nhật"}</span>
                    </div>
                  </div>
                </div>

                {/* Submit button */}
                <div className="pt-2">
                  <button
                    type="button"
                    disabled={busy || pendingApplication?.chapterCode === chapterDetail.code}
                    onClick={() => void act(
                      () => pendingApplication
                        ? api(`/me/applications/${pendingApplication._id}`, "PATCH", { chapterCode: chapterDetail.code })
                        : api("/me/applications", "POST", { chapterCode: chapterDetail.code }),
                      pendingApplication ? "Đã chuyển đơn sang Chapter mới." : "Đã gửi đơn gia nhập Chapter."
                    )}
                    className={`w-full inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold shadow-xs transition active:scale-[0.98] ${
                      pendingApplication?.chapterCode === chapterDetail.code
                        ? "bg-sky-50 text-sky-700 border border-sky-200 cursor-not-allowed"
                        : "bg-sky-600 text-white hover:bg-sky-700 shadow-sky-600/20"
                    }`}
                  >
                    {pendingApplication?.chapterCode === chapterDetail.code ? (
                      <>
                        <Clock className="h-4 w-4 text-sky-600" />
                        <span>Đơn đang chờ xác nhận</span>
                      </>
                    ) : pendingApplication ? (
                      <>
                        <ArrowRight className="h-4 w-4" />
                        <span>Chuyển đơn sang Chapter này</span>
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        <span>Nộp đơn xin gia nhập</span>
                      </>
                    )}
                  </button>
                  <p className="mt-2 text-center text-[11px] text-slate-400">
                    Hệ thống sẽ tự động dùng hồ sơ bạn đã đăng ký để gửi cho Ban điều hành xét duyệt.
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {/* 6. DÀNH CHO THÀNH VIÊN THƯỜNG */}
      {userProfile?.companyCode && !isAdmin && !isSuperadmin && (
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs sm:p-6">
          <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="h-5 w-5 text-sky-600 shrink-0" />
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Chapter đang sinh hoạt: {userProfile.companyCode}
                </h2>
                <p className="text-xs text-slate-500">
                  Tư cách thành viên chính thức
                </p>
              </div>
            </div>
            <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-700">
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
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs text-slate-800 focus:border-sky-500 focus:bg-white focus:outline-hidden"
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
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-slate-300 active:scale-95 disabled:opacity-50"
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
                <Building2 className="h-5 w-5 text-sky-600 shrink-0" />
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
                      list={key === "region" ? "vietnam-provinces-datalist" : undefined}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-800 focus:border-sky-500 focus:bg-white focus:outline-hidden"
                    />
                  </label>
                ))}
              </div>

              <datalist id="vietnam-provinces-datalist">
                {VIETNAM_PROVINCES.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.shortName} ({p.note})
                  </option>
                ))}
              </datalist>

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

      {/* POPUP BO GÓC XÁC NHẬN RÚT ĐƠN */}
      {showWithdrawConfirm && pendingApplication && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fade-in"
          role="presentation"
          onClick={() => setShowWithdrawConfirm(false)}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="withdraw-dialog-title"
            aria-describedby="withdraw-dialog-desc"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl sm:rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 transform transition-all"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
                <h2 id="withdraw-dialog-title" className="text-base font-bold text-slate-900">
                  Xác nhận rút đơn gia nhập
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowWithdrawConfirm(false)}
                aria-label="Đóng"
                className="cursor-pointer rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p id="withdraw-dialog-desc" className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Bạn có chắc chắn muốn rút đơn gia nhập Chapter{" "}
              <span className="font-bold text-slate-900">
                {chapters.find((c) => c.code === pendingApplication.chapterCode)?.name || pendingApplication.chapterCode}
              </span>
              ? Sau khi rút đơn, hồ sơ của bạn sẽ không còn trong danh sách chờ duyệt của Chapter này và bạn có thể gửi hồ sơ sang Chapter khác.
            </p>

            <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setShowWithdrawConfirm(false)}
                className="cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setShowWithdrawConfirm(false);
                  void act(
                    () => api(`/me/applications/${pendingApplication._id}`, "DELETE"),
                    "Đã rút đơn gia nhập."
                  );
                }}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-red-700 active:scale-95 disabled:opacity-50 transition"
              >
                <span>Xác nhận rút đơn</span>
              </button>
            </div>
          </section>
        </div>
      )}

    </div>
  );
}
