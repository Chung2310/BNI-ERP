import { useCallback, useEffect, useState, useMemo, type FormEvent } from "react";
import {
  Users,
  UserPlus,
  UserMinus,
  Building2,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Inbox,
  Phone,
  Mail,
  Briefcase,
  Clock,
  Check,
  X,
  FileText,
  Search,
  Plus,
  LayoutDashboard,
  Camera,
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

type ChapterMember = {
  _id: string;
  displayName: string;
  email: string;
  phone?: string;
  companyName?: string;
  industry?: string;
  photoURL?: string;
  role?: string;
};

const EMPTY_MEMBERS: ChapterMember[] = [];

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

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "Đang chờ duyệt", color: "bg-amber-50 text-amber-700 border-amber-200" },
  approved: { label: "Đã duyệt", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  rejected: { label: "Đã từ chối", color: "bg-rose-50 text-rose-700 border-rose-200" },
  withdrawn: { label: "Đã rút đơn", color: "bg-slate-100 text-slate-600 border-slate-200" },
  superseded: { label: "Chapter khác đã duyệt", color: "bg-slate-100 text-slate-500 border-slate-200" },
};

function formatDate(dateStr?: string) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

export default function ChapterPortal() {
  const { userProfile, refreshProfile, updateProfileInfo, uploadAvatar } = useAuth();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(() => {
    const value = sessionStorage.getItem("chapter_registration_avatar_error") || "";
    sessionStorage.removeItem("chapter_registration_avatar_error");
    return value;
  });
  const [message, setMessage] = useState("");
  const [profile, setProfile] = useState({
    displayName: userProfile?.displayName || "",
    phone: userProfile?.phone || "",
    companyName: userProfile?.companyName || "",
    industry: userProfile?.industry || "",
  });
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [editChapterCode, setEditChapterCode] = useState("");
  const [selectedChapter, setSelectedChapter] = useState("");
  const [chapterData, setChapterData] = useState<{
    applications: Application[];
    leaves: LeaveRequest[];
    members: ChapterMember[];
  }>({ applications: [], leaves: [], members: [] });

  const [leaveReason, setLeaveReason] = useState("");
  const [activeTab, setActiveTab] = useState<"dashboard" | "manage">("dashboard");
  const [searchQuery, setSearchQuery] = useState("");
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

  const role = userProfile?.role;
  const isSuperadmin = role === "superadmin";
  const isAdmin = role === "admin";
  const isApplicant = Boolean(userProfile && !userProfile.companyCode && !isSuperadmin);

  const selectedChapterCode = selectedChapter || chapters.find((chapter) => chapter.code === userProfile?.companyCode)?.code || chapters[0]?.code || "";

  const reload = useCallback(async () => {
    if (!userProfile) return;
    const jobs: Promise<unknown>[] = [
      api<Chapter[]>(isSuperadmin ? "/manage" : "/").then(setChapters),
    ];

    if (isApplicant) {
      jobs.push(api<Application[]>("/me/applications").then(setApplications));
    }

    if (isAdmin) {
      jobs.push(api<Application[]>("/admin/applications").then(setApplications));
      jobs.push(api<LeaveRequest[]>("/admin/leave-requests").then(setLeaves));
    } else if (userProfile.companyCode && !isSuperadmin) {
      jobs.push(api<LeaveRequest[]>("/me/leave-requests").then(setLeaves));
    }

    if (isSuperadmin && selectedChapterCode) {
      jobs.push(
        api<typeof chapterData>(`/manage/${encodeURIComponent(selectedChapterCode)}/overview`).then(
          (data) => {
            setChapterData(data);
          }
        )
      );
    }

    await Promise.all(jobs);
  }, [isApplicant, isAdmin, isSuperadmin, userProfile, selectedChapterCode]);

  useEffect(() => {
    void reload().catch((reason) => setError(reason.message));
  }, [reload]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void reload().catch(() => undefined);
      void refreshProfile();
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [reload, refreshProfile]);

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

  const effectiveChapterCode = isSuperadmin ? selectedChapterCode : userProfile?.companyCode || "";

  function decideApplication(id: string) {
    void act(
      () =>
        api(`/admin/applications/${id}/decision`, "POST", {
          decision: "approved",
          chapterCode: effectiveChapterCode,
        }),
      "Đã xác nhận và kích hoạt thành viên."
    );
  }

  function decideLeave(id: string) {
    void act(
      () =>
        api(`/admin/leave-requests/${id}/decision`, "POST", {
          decision: "approved",
          chapterCode: effectiveChapterCode,
        }),
      "Đã xác nhận thành viên rời chapter."
    );
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    await act(async () => {
      await updateProfileInfo(profile.displayName, userProfile?.photoURL || "", {
        email: userProfile?.email || "",
        phone: profile.phone,
        companyName: profile.companyName,
        industry: profile.industry,
        birthDate: userProfile?.birthDate || "",
        coverImage: userProfile?.coverImage || "",
      });
      if (avatar) {
        await uploadAvatar(avatar);
        setAvatar(null);
        setAvatarPreview(null);
      }
    }, "Đã cập nhật hồ sơ thành công.");
  }

  async function createChapter(event: FormEvent) {
    event.preventDefault();
    await act(
      () => api("/manage", "POST", newChapter),
      "Đã khởi tạo Chapter mới và tài khoản Quản trị viên."
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

  // Active dataset depending on role
  const activeApplications = isSuperadmin ? chapterData.applications : applications;
  const activeLeaves = isSuperadmin ? chapterData.leaves : leaves;
  const activeMembers = isSuperadmin ? chapterData.members : EMPTY_MEMBERS;

  const pendingAppsCount = activeApplications.filter((a) => a.status === "pending").length;
  const pendingLeavesCount = activeLeaves.filter((l) => l.status === "pending").length;

  // Search filtering
  const q = searchQuery.toLowerCase().trim();

  const filteredApplications = useMemo(() => {
    if (!q) return activeApplications;
    return activeApplications.filter((app) => {
      const snap = app.profileSnapshot;
      return (
        snap?.displayName?.toLowerCase().includes(q) ||
        snap?.email?.toLowerCase().includes(q) ||
        snap?.phone?.toLowerCase().includes(q) ||
        snap?.companyName?.toLowerCase().includes(q) ||
        snap?.industry?.toLowerCase().includes(q)
      );
    });
  }, [activeApplications, q]);

  const filteredLeaves = useMemo(() => {
    if (!q) return activeLeaves;
    return activeLeaves.filter((req) => {
      const name = typeof req.userId === "object" ? req.userId?.displayName || "" : "";
      const email = typeof req.userId === "object" ? req.userId?.email || "" : "";
      const reason = req.reason || "";
      return name.toLowerCase().includes(q) || email.toLowerCase().includes(q) || reason.toLowerCase().includes(q);
    });
  }, [activeLeaves, q]);

  const filteredMembers = useMemo(() => {
    if (!q) return activeMembers;
    return activeMembers.filter((m) => {
      return (
        m.displayName?.toLowerCase().includes(q) ||
        m.email?.toLowerCase().includes(q) ||
        m.phone?.toLowerCase().includes(q) ||
        m.companyName?.toLowerCase().includes(q) ||
        m.industry?.toLowerCase().includes(q)
      );
    });
  }, [activeMembers, q]);

  const currentChapterObj = chapters.find((c) => c.code === effectiveChapterCode);

  return (
    <div className="space-y-5">
      {/* 1. PAGE HEADER (Tiêu chuẩn ERP Ảnh 1) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="h-7 w-1.5 shrink-0 rounded-full bg-red-600" />
          <div>
            <h1 className="font-extrabold text-xl tracking-tight text-slate-900 md:text-2xl">
              Chapter & Tư cách thành viên
            </h1>
            <p className="text-xs font-medium text-slate-500">
              Quản lý tiếp nhận đơn đăng ký, duyệt thành viên và phân bổ chapter
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isSuperadmin && activeTab === "manage" && (
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

      {/* 2. SUB-TABS (Dành riêng cho Superadmin để tách riêng Quản lý Chapter hệ thống) */}
      {isSuperadmin && (
        <div className="flex gap-1.5 overflow-x-auto rounded-2xl bg-slate-100/90 p-1 select-none">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
              activeTab === "dashboard"
                ? "bg-white text-slate-900 shadow-2xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/60 font-semibold"
            }`}
          >
            <LayoutDashboard className={`h-4 w-4 ${activeTab === "dashboard" ? "text-sky-600" : "text-slate-400"}`} />
            <span>Điều hành Chapter</span>
          </button>

          <button
            onClick={() => setActiveTab("manage")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
              activeTab === "manage"
                ? "bg-white text-slate-900 shadow-2xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/60 font-semibold"
            }`}
          >
            <Building2 className={`h-4 w-4 ${activeTab === "manage" ? "text-sky-600" : "text-slate-400"}`} />
            <span>Danh sách & Cài đặt Chapter ({chapters.length})</span>
          </button>
        </div>
      )}

      {/* 3. ALERTS */}
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

      {/* 4. TAB: ĐIỀU HÀNH CHAPTER (Cả Admin và Superadmin đều dùng chung layout này) */}
      {(isAdmin || (isSuperadmin && activeTab === "dashboard")) && (
        <div className="space-y-5">
          {/* THANH TÌM KIẾM & BỘ LỌC CHAPTER (Gần ô tìm kiếm như yêu cầu) */}
          <div className="flex flex-col gap-2.5 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
            {/* Ô tìm kiếm tên thành viên, công ty... */}
            <div className="relative min-w-[220px] flex-1 max-w-md">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm theo tên thành viên, email, số điện thoại, công ty..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-1.5 pl-8 pr-7 text-xs font-normal text-slate-800 placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:outline-hidden"
              />
              <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  ×
                </button>
              )}
            </div>

            {/* BỘ LỌC CHỌN CHAPTER DÀNH CHO SUPERADMIN */}
            {isSuperadmin && (
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-sky-600" />
                  <span>Chọn Chapter:</span>
                </span>
                <select
                  aria-label="Chọn chapter để xem"
                  value={selectedChapterCode}
                  onChange={(e) => setSelectedChapter(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50/70 py-1.5 pl-3 pr-8 text-xs font-bold text-slate-800 focus:border-sky-500 focus:bg-white focus:outline-hidden cursor-pointer"
                >
                  {chapters.map((ch) => (
                    <option key={ch.code} value={ch.code}>
                      {ch.name} ({ch.code})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* 4 THẺ CHỈ SỐ KPI TỔNG QUAN CỦA CHAPTER */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {/* Card 1: Đơn chờ duyệt */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Đơn chờ duyệt</span>
                <UserPlus className="h-4 w-4 text-amber-500" />
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-bold tracking-tight text-slate-800">{pendingAppsCount}</span>
                <span className="text-xs text-slate-400">hồ sơ</span>
              </div>
              <div className="mt-1.5 truncate text-[11px] text-slate-500">
                {pendingAppsCount > 0 ? "Cần phê duyệt" : "Đã duyệt hết"}
              </div>
            </div>

            {/* Card 2: Yêu cầu rời chapter */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Yêu cầu rời</span>
                <UserMinus className="h-4 w-4 text-rose-500" />
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-bold tracking-tight text-slate-800">{pendingLeavesCount}</span>
                <span className="text-xs text-slate-400">yêu cầu</span>
              </div>
              <div className="mt-1.5 truncate text-[11px] text-slate-500">
                {pendingLeavesCount > 0 ? "Chờ xác nhận" : "Không có yêu cầu"}
              </div>
            </div>

            {/* Card 3: Mã Chapter đang xem */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Chapter đang xem</span>
                <Building2 className="h-4 w-4 text-sky-500" />
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-bold tracking-tight text-slate-800 truncate">
                  {currentChapterObj?.name || effectiveChapterCode}
                </span>
              </div>
              <div className="mt-1.5 truncate text-[11px] text-slate-500">
                Mã: {effectiveChapterCode}
              </div>
            </div>

            {/* Card 4: Thành viên chính thức */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Thành viên</span>
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-bold tracking-tight text-slate-800">
                  {isSuperadmin ? activeMembers.length : "Chính thức"}
                </span>
                {isSuperadmin && <span className="text-xs text-slate-400">người</span>}
              </div>
              <div className="mt-1.5 truncate text-[11px] text-slate-500">
                {isSuperadmin ? "Đang sinh hoạt" : `Admin: ${userProfile?.displayName}`}
              </div>
            </div>
          </div>

          {/* KHỐI 1: ĐƠN GIA NHẬP CHỜ XÁC NHẬN */}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
                  <UserPlus className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Đơn gia nhập chờ xác nhận
                  </h2>
                  <p className="text-xs text-slate-500">
                    Các hồ sơ ứng viên đăng ký tham gia Chapter {effectiveChapterCode}
                  </p>
                </div>
              </div>

              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                {filteredApplications.length} đơn
              </span>
            </div>

            {filteredApplications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">
                  <Inbox className="h-6 w-6" />
                </div>
                <p className="text-sm font-semibold text-slate-700">
                  Không có đơn chờ duyệt nào
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Hiện tại không có thành viên nào đang gửi đơn xin gia nhập Chapter {effectiveChapterCode}.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {filteredApplications.map((application) => {
                  const snap = application.profileSnapshot;
                  const initials = snap?.displayName
                    ? snap.displayName.split(" ").slice(-2).map((n) => n[0]).join("").toUpperCase()
                    : "BN";

                  return (
                    <div
                      key={application._id}
                      className="flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs transition-all hover:border-sky-300"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            {snap?.photoURL ? (
                              <img
                                src={snap.photoURL}
                                alt={snap.displayName || "Avatar"}
                                className="h-11 w-11 shrink-0 rounded-full border border-slate-200 object-cover shadow-2xs"
                              />
                            ) : (
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-100 font-bold text-sky-700 text-sm">
                                {initials}
                              </div>
                            )}
                            <div className="min-w-0">
                              <h3 className="truncate text-sm font-bold text-slate-900">
                                {snap?.displayName || "Chưa cập nhật tên"}
                              </h3>
                              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                <Mail className="h-3 w-3 shrink-0 text-slate-400" />
                                <span className="truncate">{snap?.email || "Chưa có email"}</span>
                              </div>
                            </div>
                          </div>

                          <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                            Chờ duyệt
                          </span>
                        </div>

                        <div className="space-y-1.5 rounded-lg bg-slate-50/80 p-2.5 text-xs text-slate-600">
                          {snap?.phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              <a
                                href={`tel:${snap.phone}`}
                                className="font-medium text-slate-700 hover:text-sky-600"
                              >
                                {snap.phone}
                              </a>
                            </div>
                          )}
                          {snap?.companyName && (
                            <div className="flex items-center gap-2">
                              <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              <span className="font-medium text-slate-800">{snap.companyName}</span>
                            </div>
                          )}
                          {snap?.industry && (
                            <div className="flex items-center gap-2">
                              <Briefcase className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              <span className="text-slate-600">{snap.industry}</span>
                            </div>
                          )}
                          {snap?.referral && (
                            <div className="mt-1 border-t border-slate-200/60 pt-1 text-[11px] text-slate-500">
                              Người giới thiệu: <span className="font-medium text-slate-700">{snap.referral}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 pt-1">
                            <Clock className="h-3 w-3" />
                            <span>Đã nộp: {formatDate(application.createdAt)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex justify-end gap-2 border-t border-slate-100 pt-3">
                        <button
                          disabled={busy}
                          onClick={() => decideApplication(application._id)}
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>Xác nhận duyệt thành viên</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* KHỐI 2: YÊU CẦU RỜI CHAPTER */}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                  <UserMinus className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Yêu cầu rời chapter
                  </h2>
                  <p className="text-xs text-slate-500">
                    Thành viên xin rút khỏi Chapter {effectiveChapterCode}
                  </p>
                </div>
              </div>

              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                {filteredLeaves.length} yêu cầu
              </span>
            </div>

            {filteredLeaves.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">
                  <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                </div>
                <p className="text-sm font-semibold text-slate-700">
                  Không có yêu cầu rời chapter nào
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Tất cả thành viên trong Chapter {effectiveChapterCode} đang hoạt động bình thường.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {filteredLeaves.map((request) => {
                  const memberName =
                    typeof request.userId === "object"
                      ? request.userId?.displayName || "Thành viên"
                      : request.userId || "Thành viên";
                  const memberEmail =
                    typeof request.userId === "object" ? request.userId?.email : "";

                  return (
                    <div
                      key={request._id}
                      className="flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs transition-all hover:border-rose-300"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="text-sm font-bold text-slate-900">{memberName}</h3>
                            {memberEmail && (
                              <p className="text-xs text-slate-500">{memberEmail}</p>
                            )}
                          </div>
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                            Chờ duyệt rời
                          </span>
                        </div>

                        {request.reason && (
                          <div className="rounded-lg bg-rose-50/50 border border-rose-100 p-2.5 text-xs text-slate-700">
                            <span className="font-semibold text-rose-700">Lý do xin rời:</span>
                            <p className="mt-0.5 italic">{request.reason}</p>
                          </div>
                        )}

                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                          <Clock className="h-3 w-3" />
                          <span>Thời gian yêu cầu: {formatDate(request.createdAt)}</span>
                        </div>
                      </div>

                      <div className="mt-3 flex justify-end border-t border-slate-100 pt-3">
                        <button
                          disabled={busy}
                          onClick={() => decideLeave(request._id)}
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-rose-700 active:scale-95 disabled:opacity-50"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>Xác nhận cho rời Chapter</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* KHỐI 3: DANH SÁCH THÀNH VIÊN ĐANG HOẠT ĐỘNG (Dành cho Superadmin khi soi Chapter) */}
          {isSuperadmin && (
            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs sm:p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <Users className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">
                      Danh sách thành viên hiện tại · Chapter {effectiveChapterCode}
                    </h2>
                    <p className="text-xs text-slate-500">
                      Tất cả thành viên chính thức đang sinh hoạt trong Chapter này
                    </p>
                  </div>
                </div>

                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                  {filteredMembers.length} thành viên
                </span>
              </div>

              {filteredMembers.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Không tìm thấy thành viên nào phù hợp trong Chapter này.
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredMembers.map((member) => (
                    <div
                      key={member._id}
                      className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 text-xs shadow-2xs"
                    >
                      {member.photoURL ? (
                        <img
                          src={member.photoURL}
                          alt={member.displayName}
                          className="h-10 w-10 shrink-0 rounded-full border border-slate-200 object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-200 font-bold text-slate-600">
                          {member.displayName?.slice(0, 2).toUpperCase() || "TV"}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <p className="font-bold text-slate-900 truncate">{member.displayName}</p>
                          {member.role === "admin" && (
                            <span className="rounded-md bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">
                              Admin
                            </span>
                          )}
                        </div>
                        <p className="text-slate-500 truncate">{member.email}</p>
                        {member.phone && <p className="text-slate-600 font-mono mt-0.5">{member.phone}</p>}
                        {member.companyName && (
                          <p className="mt-1 font-medium text-slate-700 truncate">{member.companyName}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {/* 5. TAB: QUẢN LÝ HỆ THỐNG CHAPTER (Dành riêng cho Superadmin đặt vào mục riêng biệt) */}
      {isSuperadmin && activeTab === "manage" && (
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Hệ thống các Chapter BNI
                </h2>
                <p className="text-xs text-slate-500">
                  Quản lý danh sách, phân quyền và trạng thái tiếp nhận đơn của các Chapter trên toàn quốc
                </p>
              </div>

              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                {chapters.length} chapters
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {chapters.map((ch) => {
                const isAccepting = ch.acceptsApplications !== false;

                return (
                  <div
                    key={ch.code}
                    className="flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs transition-all hover:border-sky-300"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-bold text-sm text-slate-900">{ch.name}</h3>
                          <span className="font-mono text-xs font-semibold text-sky-700">
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

                    <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                      <button
                        onClick={() => {
                          setSelectedChapter(ch.code);
                          setActiveTab("dashboard");
                        }}
                        className="inline-flex cursor-pointer items-center gap-1 text-xs font-bold text-sky-600 hover:text-sky-800"
                      >
                        <span>Xem điều hành</span>
                        <ExternalLink className="h-3 w-3" />
                      </button>

                      <button
                        disabled={busy}
                        onClick={() =>
                          void act(
                            () =>
                              api(`/manage/${encodeURIComponent(ch.code)}`, "PATCH", {
                                acceptsApplications: !isAccepting,
                              }),
                            `Đã cập nhật trạng thái nhận đơn của Chapter ${ch.name}.`
                          )
                        }
                        className={`cursor-pointer rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                          !isAccepting
                            ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        {!isAccepting ? "Mở nhận đơn" : "Tạm ngưng"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* 6. MODAL KHỞI TẠO CHAPTER MỚI (Cho Superadmin, chuẩn popup ERP) */}
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
                    Khởi tạo Chapter mới & Cấp tài khoản Quản trị
                  </h2>
                  <p className="text-xs text-slate-500">
                    Tạo mã chapter mới và đồng thời tạo tài khoản Admin quản lý chapter
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
                  <span>Xác nhận khởi tạo</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. APPLICANT VIEW (Chưa thuộc chapter nào và không phải Superadmin) */}
      {isApplicant && (
        <div className="space-y-6">
          {/* Profile Form */}
          <form
            onSubmit={saveProfile}
            className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs sm:p-6"
          >
            <div className="mb-4 flex items-center gap-2.5 border-b border-slate-100 pb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
                <Briefcase className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Hồ sơ cá nhân & Doanh nghiệp
                </h2>
                <p className="text-xs text-slate-500">
                  Cung cấp đầy đủ thông tin để Ban điều hành Chapter dễ dàng phê duyệt hồ sơ
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-slate-700">
                Họ và tên <span className="text-rose-500">*</span>
                <input
                  required
                  value={profile.displayName}
                  onChange={(e) => setProfile((p) => ({ ...p, displayName: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-800 focus:border-sky-500 focus:bg-white focus:outline-hidden"
                  placeholder="Nguyễn Văn A"
                />
              </label>

              <label className="text-xs font-medium text-slate-700">
                Số điện thoại liên hệ <span className="text-rose-500">*</span>
                <input
                  required
                  value={profile.phone}
                  onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-800 focus:border-sky-500 focus:bg-white focus:outline-hidden"
                  placeholder="0912345678"
                />
              </label>

              <label className="text-xs font-medium text-slate-700">
                Tên Doanh nghiệp / Công ty <span className="text-rose-500">*</span>
                <input
                  required
                  value={profile.companyName}
                  onChange={(e) => setProfile((p) => ({ ...p, companyName: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-800 focus:border-sky-500 focus:bg-white focus:outline-hidden"
                  placeholder="Công ty CP ABC"
                />
              </label>

              <label className="text-xs font-medium text-slate-700">
                Ngành nghề / Lĩnh vực hoạt động <span className="text-rose-500">*</span>
                <input
                  required
                  value={profile.industry}
                  onChange={(e) => setProfile((p) => ({ ...p, industry: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-800 focus:border-sky-500 focus:bg-white focus:outline-hidden"
                  placeholder="Công nghệ thông tin..."
                />
              </label>
            </div>

            <div className="mt-4 border-t border-slate-100 pt-4">
              <label className="block text-xs font-medium text-slate-700">
                Ảnh chân dung đại diện
                <div className="mt-2 flex items-center gap-4">
                  {(avatarPreview || userProfile?.photoURL) ? (
                    <img
                      src={avatarPreview || userProfile?.photoURL || ""}
                      alt="Avatar Preview"
                      className="h-14 w-14 rounded-full border border-slate-200 object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                      <Camera className="h-6 w-6" />
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setAvatar(file);
                      if (file) {
                        setAvatarPreview(URL.createObjectURL(file));
                      } else {
                        setAvatarPreview(null);
                      }
                    }}
                    className="text-xs text-slate-600 file:mr-3 file:rounded-xl file:border-0 file:bg-sky-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-sky-700 hover:file:bg-sky-100"
                  />
                </div>
              </label>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="submit"
                disabled={busy}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-sky-600 px-5 py-2.5 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-sky-700 active:scale-95 disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                <span>Lưu thông tin hồ sơ</span>
              </button>
            </div>
          </form>

          {/* Chapter Selection */}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs sm:p-6">
            <div className="mb-4 flex items-center gap-2.5 border-b border-slate-100 pb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
                <Building2 className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Đăng ký tham gia Chapter
                </h2>
                <p className="text-xs text-slate-500">
                  Chọn Chapter bạn muốn tham gia. Mỗi tài khoản chỉ nộp 1 đơn đang chờ duyệt tại một thời điểm.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {chapters.map((chapter) => (
                <div
                  key={chapter.code}
                  className="flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs transition-all hover:border-sky-300"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-bold text-slate-900">{chapter.name}</h3>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                        {chapter.code}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {chapter.chapterRegion || "Toàn quốc"}
                      {chapter.chapterAddress ? ` · ${chapter.chapterAddress}` : ""}
                    </p>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <button
                      disabled={busy || applications.some((a) => a.status === "pending")}
                      onClick={() =>
                        void act(
                          () =>
                            api("/me/applications", "POST", { chapterCode: chapter.code }),
                          `Đã gửi đơn đăng ký gia nhập Chapter ${chapter.name}.`
                        )
                      }
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-sky-700 active:scale-95 disabled:opacity-50"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      <span>Nộp đơn gia nhập</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Applications Sent */}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs sm:p-6">
            <div className="mb-4 flex items-center gap-2.5 border-b border-slate-100 pb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Lịch sử đơn đã gửi
                </h2>
                <p className="text-xs text-slate-500">
                  Theo dõi tiến độ xét duyệt đơn đăng ký của bạn
                </p>
              </div>
            </div>

            {applications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Inbox className="h-8 w-8 text-slate-300 mb-2" />
                <p className="text-xs text-slate-400">Bạn chưa nộp đơn đăng ký vào chapter nào.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {applications.map((app) => {
                  const statusInfo = STATUS_LABELS[app.status] || {
                    label: app.status,
                    color: "bg-slate-100 text-slate-600 border-slate-200",
                  };

                  return (
                    <div
                      key={app._id}
                      className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <Building2 className="h-4 w-4 text-sky-600" />
                          <span className="font-bold text-sm text-slate-800">
                            Chapter {app.chapterCode}
                          </span>
                          <span
                            className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusInfo.color}`}
                          >
                            {statusInfo.label}
                          </span>
                        </div>

                        <span className="text-xs text-slate-400">
                          {formatDate(app.createdAt)}
                        </span>
                      </div>

                      {app.decisionReason && (
                        <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
                          Ghi chú phản hồi: {app.decisionReason}
                        </p>
                      )}

                      {app.status === "pending" && (
                        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                          <select
                            aria-label="Sửa chapter trong đơn"
                            value={editChapterCode || app.chapterCode}
                            onChange={(e) => setEditChapterCode(e.target.value)}
                            className="rounded-lg border border-slate-200 bg-slate-50 p-1.5 text-xs text-slate-700"
                          >
                            {chapters.map((ch) => (
                              <option key={ch.code} value={ch.code}>
                                Chuyển sang {ch.name} ({ch.code})
                              </option>
                            ))}
                          </select>
                          <button
                            disabled={busy}
                            onClick={() =>
                              void act(
                                () =>
                                  api(`/me/applications/${app._id}`, "PATCH", {
                                    chapterCode: editChapterCode || app.chapterCode,
                                  }),
                                "Đã cập nhật lại đơn xin gia nhập."
                              )
                            }
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-50"
                          >
                            Lưu thay đổi
                          </button>
                          <button
                            disabled={busy}
                            onClick={() =>
                              void act(
                                () => api(`/me/applications/${app._id}`, "DELETE"),
                                "Đã thu hồi đơn đăng ký."
                              )
                            }
                            className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                          >
                            Rút / Hủy đơn
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* 8. REGULAR MEMBER VIEW (Thành viên chính thức, không phải admin) */}
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
                  Tư cách thành viên chính thức của Chapter {userProfile.companyCode}
                </p>
              </div>
            </div>

            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
              Đang hoạt động
            </span>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl bg-slate-50 p-4 border border-slate-200/60 text-xs text-slate-600">
              <p className="font-semibold text-slate-800">Quy trình xin rời chapter:</p>
              <p className="mt-1">
                Yêu cầu rời chapter sẽ được gửi tới Ban điều hành Chapter {userProfile.companyCode} để phê duyệt. Trong thời gian chờ xử lý, tư cách thành viên của bạn vẫn được duy trì đầy đủ.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">
                Lý do xin rời Chapter
                <textarea
                  rows={3}
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  placeholder="Vui lòng cung cấp lý do bạn muốn rời chapter để Ban điều hành hỗ trợ..."
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs text-slate-800 focus:border-rose-500 focus:bg-white focus:outline-hidden"
                />
              </label>

              <div className="mt-3 flex justify-end">
                <button
                  disabled={busy || !leaveReason.trim() || leaves.some((r) => r.status === "pending")}
                  onClick={() =>
                    void act(
                      () => api("/me/leave-requests", "POST", { reason: leaveReason }),
                      "Đã gửi yêu cầu rời chapter."
                    )
                  }
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-rose-700 active:scale-95 disabled:opacity-50"
                >
                  <UserMinus className="h-3.5 w-3.5" />
                  <span>Gửi yêu cầu rời Chapter</span>
                </button>
              </div>
            </div>

            {leaves.length > 0 && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <h3 className="text-xs font-bold text-slate-700 mb-2">Lịch sử yêu cầu rời:</h3>
                <div className="space-y-2">
                  {leaves.map((req) => (
                    <div
                      key={req._id}
                      className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-white p-3 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-800">
                          {formatDate(req.createdAt)}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                            req.status === "pending"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-slate-100 text-slate-600 border-slate-200"
                          }`}
                        >
                          {STATUS_LABELS[req.status]?.label || req.status}
                        </span>
                      </div>

                      {req.status === "pending" && (
                        <button
                          disabled={busy}
                          onClick={() =>
                            void act(
                              () => api(`/me/leave-requests/${req._id}/withdraw`, "POST"),
                              "Đã rút lại yêu cầu rời chapter."
                            )
                          }
                          className="cursor-pointer text-xs font-semibold text-rose-600 hover:underline"
                        >
                          Rút yêu cầu
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
