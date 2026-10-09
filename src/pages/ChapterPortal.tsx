import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { getAccessToken } from "../services/authService";

type Chapter = { code: string; name: string; chapterRegion?: string; chapterAddress?: string; acceptsApplications?: boolean };
type Application = { _id: string; chapterCode: string; status: string; decisionReason?: string; createdAt: string; profileSnapshot?: { displayName?: string; email?: string; phone?: string; companyName?: string; industry?: string; photoURL?: string; referral?: string; note?: string } };
type LeaveRequest = { _id: string; chapterCode: string; status: string; reason?: string; decisionReason?: string; createdAt: string; userId?: string | { displayName?: string; email?: string } };

async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(`/api/v1/chapters${path}`, {
    method,
    headers: { Authorization: `Bearer ${getAccessToken()}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || "Không thể xử lý yêu cầu.");
  return result.data as T;
}

const label: Record<string, string> = {
  pending: "Đang chờ duyệt", approved: "Đã duyệt", rejected: "Đã từ chối",
  withdrawn: "Đã rút", superseded: "Chapter khác đã duyệt",
};

export default function ChapterPortal() {
  const { userProfile, logout, refreshProfile, updateProfileInfo, uploadAvatar } = useAuth();
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
  const [profile, setProfile] = useState({ displayName: userProfile?.displayName || "", phone: userProfile?.phone || "", companyName: userProfile?.companyName || "", industry: userProfile?.industry || "" });
  const [avatar, setAvatar] = useState<File | null>(null);
  const [editChapterCode, setEditChapterCode] = useState("");
  const [selectedChapter, setSelectedChapter] = useState("");
  const [chapterData, setChapterData] = useState<{ applications: Application[]; leaves: LeaveRequest[]; members: Array<{ _id: string; displayName: string; email: string; phone?: string }> }>({ applications: [], leaves: [], members: [] });
  const [leaveReason, setLeaveReason] = useState("");
  const [newChapter, setNewChapter] = useState({ code: "", name: "", region: "", address: "", adminName: "", adminEmail: "", adminPassword: "" });
  const role = userProfile?.role;
  const isApplicant = Boolean(userProfile && !userProfile.companyCode && role !== "superadmin");

  const reload = useCallback(async () => {
    if (!userProfile) return;
    const jobs: Promise<unknown>[] = [api<Chapter[]>(role === "superadmin" ? "/manage" : "/").then(setChapters)];
    if (isApplicant) jobs.push(api<Application[]>("/me/applications").then(setApplications));
    if (role === "admin") {
      jobs.push(api<Application[]>("/admin/applications").then(setApplications));
      jobs.push(api<LeaveRequest[]>("/admin/leave-requests").then(setLeaves));
    } else if (userProfile.companyCode) jobs.push(api<LeaveRequest[]>("/me/leave-requests").then(setLeaves));
    if (role === "superadmin" && selectedChapter) jobs.push(api<typeof chapterData>(`/manage/${encodeURIComponent(selectedChapter)}/overview`).then(setChapterData));
    await Promise.all(jobs);
  }, [isApplicant, role, userProfile, selectedChapter]);

  useEffect(() => { void reload().catch(reason => setError(reason.message)); }, [reload]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      void reload().catch(() => undefined);
      void refreshProfile();
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [reload, refreshProfile]);

  async function act(action: () => Promise<unknown>, success: string) {
    setBusy(true); setError(""); setMessage("");
    try { await action(); await reload(); await refreshProfile(); setMessage(success); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể xử lý yêu cầu."); }
    finally { setBusy(false); }
  }

  function decideApplication(id: string) {
    void act(() => api(`/admin/applications/${id}/decision`, "POST", { decision: "approved" }), "Đã xác nhận thành viên.");
  }
  function decideLeave(id: string) {
    void act(() => api(`/admin/leave-requests/${id}/decision`, "POST", { decision: "approved" }), "Đã xác nhận rời chapter.");
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    await act(async () => {
      await updateProfileInfo(profile.displayName, userProfile?.photoURL || "", {
        email: userProfile?.email || "", phone: profile.phone, companyName: profile.companyName,
        industry: profile.industry, birthDate: userProfile?.birthDate || "", coverImage: userProfile?.coverImage || "",
      });
      if (avatar) { await uploadAvatar(avatar); setAvatar(null); }
    }, "Đã cập nhật hồ sơ.");
  }

  async function createChapter(event: FormEvent) {
    event.preventDefault();
    await act(() => api("/manage", "POST", newChapter), "Đã tạo chapter và tài khoản admin.");
  }

  return <main className="min-h-dvh bg-slate-50 px-4 py-8 text-slate-900">
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-2xl font-bold">Chapter BNI</h1><p className="mt-1 text-sm text-slate-600">Xin chào {userProfile?.displayName}.</p></div>
        <div className="flex gap-3 text-sm"><a href="/" className="rounded-xl border border-slate-300 bg-white px-4 py-2">Về ứng dụng</a><button onClick={() => void logout()} className="rounded-xl border border-slate-300 bg-white px-4 py-2">Đăng xuất</button></div>
      </header>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="rounded-xl bg-green-50 p-4 text-sm text-green-700">{message}</p>}

      {isApplicant && <>
        <form onSubmit={saveProfile} className="rounded-2xl border bg-white p-5">
          <h2 className="text-lg font-semibold">Hồ sơ cá nhân</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">{([
            ["displayName", "Họ và tên"], ["phone", "Số điện thoại"],
            ["companyName", "Công ty"], ["industry", "Lĩnh vực"],
          ] as const).map(([key, title]) => <label key={key} className="text-sm">{title}<input required value={profile[key]} onChange={event => setProfile(current => ({ ...current, [key]: event.target.value }))} className="mt-1 w-full rounded-lg border p-2" /></label>)}</div>
          <label className="mt-3 block text-sm">Ảnh đại diện<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setAvatar(event.target.files?.[0] || null)} className="mt-1 block w-full" /></label>
          <button disabled={busy} className="mt-3 rounded-lg bg-sky-700 px-3 py-2 text-sm text-white disabled:opacity-50">Lưu hồ sơ</button>
        </form>
        <section className="rounded-2xl border bg-white p-5"><h2 className="text-lg font-semibold">Đăng ký thành viên</h2><p className="mt-2 text-sm text-slate-600">Mỗi tài khoản chỉ có một đơn đang chờ. Bạn có thể sửa chapter hoặc xóa đơn trước khi admin xác nhận.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {chapters.map(chapter => <div key={chapter.code} className="rounded-xl border border-slate-200 p-4">
              <h3 className="font-semibold">{chapter.name}</h3><p className="text-sm text-slate-500">{chapter.chapterRegion || chapter.code}{chapter.chapterAddress ? ` · ${chapter.chapterAddress}` : ""}</p>
              <button disabled={busy || applications.some(a => a.status === "pending")}
                onClick={() => void act(() => api("/me/applications", "POST", { chapterCode: chapter.code }), "Đã nộp đơn cho chapter.")}
                className="mt-3 rounded-lg bg-sky-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Nộp đơn</button>
            </div>)}
          </div>
        </section>
        <section className="rounded-2xl border bg-white p-5"><h2 className="text-lg font-semibold">Đơn đã gửi</h2><div className="mt-3 space-y-2">{applications.length === 0 && <p className="text-sm text-slate-500">Bạn chưa gửi đơn nào.</p>}{applications.map(application => <div key={application._id} className="rounded-xl border p-3 text-sm"><span>{application.chapterCode} · {label[application.status] || application.status}</span>{application.status === "pending" && <div className="mt-2 flex flex-wrap items-center gap-2"><select aria-label="Sửa chapter trong đơn" value={editChapterCode || application.chapterCode} onChange={event => setEditChapterCode(event.target.value)} className="rounded-lg border p-2">{chapters.map(chapter => <option key={chapter.code} value={chapter.code}>{chapter.name}</option>)}</select><button disabled={busy} onClick={() => void act(() => api(`/me/applications/${application._id}`, "PATCH", { chapterCode: editChapterCode || application.chapterCode }), "Đã sửa đơn.")} className="text-sky-700">Sửa đơn</button><button disabled={busy} onClick={() => void act(() => api(`/me/applications/${application._id}`, "DELETE"), "Đã xóa đơn.")} className="text-red-700">Xóa đơn</button></div>}</div>)}</div></section>
      </>}

      {role === "superadmin" && <>
        <section className="rounded-2xl border bg-white p-5"><label className="text-sm font-semibold">Xem dữ liệu chapter<select aria-label="Lọc chapter" value={selectedChapter} onChange={event => setSelectedChapter(event.target.value)} className="mt-2 block w-full rounded-lg border p-2"><option value="">Chọn chapter</option>{chapters.map(chapter => <option key={chapter.code} value={chapter.code}>{chapter.name}</option>)}</select></label>
          {selectedChapter && <div className="mt-4 grid gap-4 sm:grid-cols-3"><div><h3 className="font-semibold">Thành viên ({chapterData.members.length})</h3>{chapterData.members.map(member => <p key={member._id} className="mt-2 text-sm">{member.displayName} · {member.email}</p>)}</div><div><h3 className="font-semibold">Đơn chờ ({chapterData.applications.length})</h3>{chapterData.applications.map(application => <p key={application._id} className="mt-2 text-sm">{application.profileSnapshot?.displayName} · {application.profileSnapshot?.email}</p>)}</div><div><h3 className="font-semibold">Yêu cầu rời ({chapterData.leaves.length})</h3>{chapterData.leaves.map(request => <p key={request._id} className="mt-2 text-sm">{typeof request.userId === "object" ? request.userId?.displayName : request.userId}</p>)}</div></div>}
        </section>
        <form onSubmit={createChapter} className="rounded-2xl border bg-white p-5"><h2 className="text-lg font-semibold">Tạo chapter và admin</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{([
          ["code", "Mã chapter"], ["name", "Tên chapter"], ["region", "Khu vực"], ["address", "Địa chỉ"],
          ["adminName", "Tên admin"], ["adminEmail", "Email admin"], ["adminPassword", "Mật khẩu admin"],
        ] as const).map(([key, title]) => <label key={key} className="text-sm">{title}<input required={!["region", "address"].includes(key)} type={key === "adminEmail" ? "email" : key === "adminPassword" ? "password" : "text"} value={newChapter[key]} onChange={e => setNewChapter(current => ({ ...current, [key]: e.target.value }))} className="mt-1 w-full rounded-lg border p-2" /></label>)}</div><button disabled={busy} className="mt-4 rounded-xl bg-sky-700 px-4 py-2 font-medium text-white disabled:opacity-50">Tạo chapter</button></form>
        <section className="rounded-2xl border bg-white p-5"><h2 className="text-lg font-semibold">Danh sách chapter</h2><div className="mt-3 space-y-2">{chapters.map(chapter => <div key={chapter.code} className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm"><span>{chapter.name} ({chapter.code})</span><button disabled={busy} onClick={() => void act(() => api(`/manage/${encodeURIComponent(chapter.code)}`, "PATCH", { acceptsApplications: !chapter.acceptsApplications }), "Đã cập nhật chapter.")} className="text-sky-700">{chapter.acceptsApplications === false ? "Mở nhận đơn" : "Tạm ngừng nhận đơn"}</button></div>)}</div></section>
      </>}

      {role === "admin" && <>
        <section className="rounded-2xl border bg-white p-5"><h2 className="text-lg font-semibold">Đơn gia nhập chờ xác nhận · {userProfile?.companyCode}</h2><div className="mt-3 space-y-3">{applications.length === 0 && <p className="text-sm text-slate-500">Không có đơn chờ.</p>}{applications.map(application => <div key={application._id} className="rounded-xl border p-4 text-sm"><div className="flex items-center gap-3">{application.profileSnapshot?.photoURL && <img src={application.profileSnapshot.photoURL} alt="Ảnh người nộp đơn" className="h-12 w-12 rounded-full object-cover" />}<p className="font-semibold">{application.profileSnapshot?.displayName} · {application.profileSnapshot?.email}</p></div><p className="mt-1 text-slate-600">{application.profileSnapshot?.phone} · {application.profileSnapshot?.companyName} · {application.profileSnapshot?.industry}</p><button disabled={busy} onClick={() => decideApplication(application._id)} className="mt-3 rounded-lg bg-green-700 px-3 py-2 text-white">Xác nhận</button></div>)}</div></section>
        <section className="rounded-2xl border bg-white p-5"><h2 className="text-lg font-semibold">Yêu cầu rời chapter</h2><div className="mt-3 space-y-3">{leaves.length === 0 && <p className="text-sm text-slate-500">Không có yêu cầu chờ.</p>}{leaves.map(request => <div key={request._id} className="rounded-xl border p-4 text-sm"><p>Thành viên: {typeof request.userId === "object" ? `${request.userId?.displayName || ""} · ${request.userId?.email || ""}` : request.userId}</p><p className="mt-1">Lý do: {request.reason || "Không nêu"}</p><button disabled={busy} onClick={() => decideLeave(request._id)} className="mt-3 rounded-lg bg-green-700 px-3 py-2 text-white">Xác nhận rời</button></div>)}</div></section>
      </>}

      {userProfile?.companyCode && role !== "admin" && role !== "superadmin" && <section className="rounded-2xl border bg-white p-5"><h2 className="text-lg font-semibold">Chapter đang sinh hoạt: {userProfile.companyCode}</h2><p className="mt-2 text-sm text-slate-600">Yêu cầu rời chapter cần admin duyệt. Bạn vẫn là thành viên trong thời gian chờ.</p><textarea value={leaveReason} onChange={e => setLeaveReason(e.target.value)} placeholder="Lý do rời chapter" className="mt-4 w-full rounded-xl border p-3 text-sm" /><button disabled={busy || leaves.some(request => request.status === "pending")} onClick={() => void act(() => api("/me/leave-requests", "POST", { reason: leaveReason }), "Đã gửi yêu cầu rời chapter.")} className="mt-2 rounded-xl bg-sky-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Gửi yêu cầu rời</button><div className="mt-4 space-y-2 text-sm">{leaves.map(request => <div key={request._id} className="flex justify-between rounded-xl border p-3"><span>{label[request.status] || request.status}</span>{request.status === "pending" && <button disabled={busy} onClick={() => void act(() => api(`/me/leave-requests/${request._id}/withdraw`, "POST"), "Đã rút yêu cầu.")} className="text-red-700">Rút yêu cầu</button>}</div>)}</div></section>}
    </div>
  </main>;
}
