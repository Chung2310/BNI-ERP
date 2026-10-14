import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Mail,
  Search,
  ShieldAlert,
  Trash2,
  Unplug,
} from "lucide-react";
import { SEOHead } from "../seo/SEOHead";
import { getApiErrorMessage } from "../utils/errorMessage";
import { getAccountDeletionReceipt } from "../services/authService";
import {
  BRAND_NAME,
  SERVICE_WEBSITE_URL,
  SUPPORT_EMAIL,
  USER_DATA_DELETION_URL,
} from "../config/brand";

interface DeletionStatus {
  code: string;
  facebookUserId: string;
  status: "pending" | "processing" | "completed" | "failed";
  requestedAt: string;
  completedAt?: string;
  details?: string;
}

const lastUpdated = "October 14, 2026";

async function fetchDeletionStatus(code: string): Promise<DeletionStatus> {
  const accountReceipt = /^[a-f0-9]{64}$/.test(code);
  const response = await fetch(accountReceipt ? "/api/v1/auth/account-deletion-status" : `/api/v1/facebook/data-deletion-status/${encodeURIComponent(code)}`, {
    headers: accountReceipt ? { "X-Deletion-Token": code } : {}, cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || "Deletion request code not found.");
  return accountReceipt ? { code, facebookUserId: "", status: result.data.state, requestedAt: result.data.requestedAt, completedAt: result.data.completedAt } : result.data;
}

export default function UserDataDeletion() {
  const [initialCode] = useState(() => { const params = new URLSearchParams(window.location.search); return params.get("code") || params.get("id") || getAccountDeletionReceipt() || ""; });
  const [code, setCode] = useState(initialCode);
  const [loading, setLoading] = useState(!!initialCode);
  const [error, setError] = useState<string | null>(null);
  const [statusResult, setStatusResult] = useState<DeletionStatus | null>(null);

  const meta = {
    title: `User Data Deletion | ${BRAND_NAME}`,
    description: `Instructions for disconnecting integrations and requesting user data deletion from ${BRAND_NAME}.`,
    keywords: "user data deletion, TikTok Shop data deletion, Facebook data deletion, iGen Connect, iGen ERP",
    path: "/user-data-deletion",
  };

  useEffect(() => {
    if (!initialCode) return;
    let active = true;
    fetchDeletionStatus(initialCode.trim())
      .then(result => { if (active) setStatusResult(result); })
      .catch(error => { if (active) setError(getApiErrorMessage(error, "Không thể kiểm tra trạng thái yêu cầu xóa dữ liệu.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [initialCode]);

  async function handleCheckStatus(checkCode: string) {
    const activeCode = checkCode || code;
    if (!activeCode.trim()) {
      setError("Please enter a deletion request code.");
      return;
    }

    setLoading(true);
    setError(null);
    setStatusResult(null);

    try {
      setStatusResult(await fetchDeletionStatus(activeCode.trim()));
    } catch (err) {
      setError(getApiErrorMessage(err, "Không thể kiểm tra trạng thái yêu cầu xóa dữ liệu."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <SEOHead meta={meta} />

      <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-bold uppercase tracking-wider">
              <ShieldAlert className="h-4 w-4" />
              <span>Privacy Control</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
              User Data Deletion
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-600">
              This page explains how users can disconnect third-party integrations, revoke
              platform access and request deletion of eligible data associated with{" "}
              {BRAND_NAME}.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm shrink-0">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Service
              </p>
              <p className="mt-1 font-semibold text-slate-800">{BRAND_NAME}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Last Updated
              </p>
              <p className="mt-1 font-semibold text-slate-800">{lastUpdated}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Search className="h-5 w-5 text-slate-700" />
              Check Request Status
            </h2>
            <p className="text-sm leading-6 text-slate-600">
              Nhập mã theo dõi được cấp sau khi xóa tài khoản trong ứng dụng hoặc mã xóa dữ liệu Facebook. Không cần đăng nhập. Mã xóa tài khoản có hiệu lực đến 30 ngày sau khi hoàn tất; hãy giữ mã riêng tư.
            </p>

            <div className="space-y-3">
              <input
                type="text"
                placeholder="Example: DEL-3E5A29CD"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void handleCheckStatus("")}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-slate-400 focus:bg-white"
              />
              <button
                onClick={() => void handleCheckStatus("")}
                disabled={loading}
                className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:bg-slate-300"
              >
                {loading ? "Checking..." : "Check status"}
              </button>
            </div>

            {error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {statusResult && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
                  <span className="min-w-0 break-all font-mono font-semibold text-slate-800">{statusResult.code}</span>
                  {statusResult.status === "completed" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                      <CheckCircle2 className="h-3 w-3" />
                      Completed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                      <Clock className="h-3 w-3" />
                      Processing
                    </span>
                  )}
                </div>

                <div className="space-y-2 text-slate-600">
                  {statusResult.facebookUserId ? <p>
                    Platform user reference:{" "}
                    <span className="font-mono text-slate-800">
                      {statusResult.facebookUserId.slice(0, 6)}***
                    </span>
                  </p> : null}
                  <p>
                    Requested at:{" "}
                    <span className="text-slate-800">
                      {new Date(statusResult.requestedAt).toLocaleString("en-US")}
                    </span>
                  </p>
                  {statusResult.completedAt && (
                    <p>
                      Completed at:{" "}
                      <span className="text-slate-800">
                        {new Date(statusResult.completedAt).toLocaleString("en-US")}
                      </span>
                    </p>
                  )}
                  {statusResult.details && (
                    <p className="rounded-xl bg-white px-3 py-2 text-xs leading-5 text-slate-600 border border-slate-200">
                      {statusResult.details}
                    </p>
                  )}
                </div>
              </div>
            )}

            <p className="text-xs leading-5 text-slate-500">
              Yêu cầu xóa tài khoản thường hoàn tất trong vài phút. Khi dịch vụ lưu trữ gặp lỗi, hệ thống tiếp tục thử lại. Nếu quá 24 giờ, có thể liên hệ hỗ trợ kèm mã theo dõi. Các yêu cầu TikTok gửi ngoài luồng tự động dùng kênh hỗ trợ bên dưới.
            </p>
          </div>
        </div>

        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-3xl p-6 lg:p-8 shadow-sm space-y-8">
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">Xóa tài khoản iGen Connect và dữ liệu</h2>
            <p className="text-sm leading-6 text-slate-600">Trong app: Cài đặt → Quyền riêng tư → Xóa tài khoản. Trên web: Cài đặt tài khoản → Xóa tài khoản của tôi. Xác nhận bằng mật khẩu hiện tại. Quản trị viên chọn người nhận quyền trong cùng Chapter; nếu không còn thành viên đang hoạt động khác, Chapter được lưu trữ. Bạn sẽ đăng xuất ngay khi yêu cầu được tiếp nhận và có mã riêng để theo dõi; không cần gửi email để thực hiện xóa.</p>
            <p className="text-sm leading-6 text-slate-600">Hồ sơ, ảnh cá nhân, tin nhắn và tệp bạn gửi/tải lên gắn với tài khoản, đăng ký thông báo, đơn gia nhập/rời Chapter và lịch sử hoạt động sẽ được xóa. Danh tính trong cuộc họp và trò chơi được gỡ bỏ. Cuộc họp, nội dung của người khác và số liệu thu chi đã loại bỏ danh tính vẫn được giữ. Không thể thu hồi bản sao đã được người nhận tải xuống hay tệp đã xuất ra ngoài ứng dụng.</p>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Unplug className="h-5 w-5 text-slate-700" />
              1. Disconnect Inside The Application
            </h2>
            <p className="text-sm leading-6 text-slate-600">
              If you connected TikTok Shop, Facebook or another supported channel to{" "}
              {BRAND_NAME}, you can remove that connection from the integration settings in
              your account. Once disconnected, the system will stop using the related access
              token for future synchronization.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-slate-700" />
              2. Revoke Access From The Third-Party Platform
            </h2>
            <p className="text-sm leading-6 text-slate-600">
              You may also revoke the application's access directly from the settings page of
              the connected platform. After revocation, the service will no longer be able to
              retrieve new data from that platform.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="font-semibold text-slate-800">TikTok Shop or TikTok Account</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Revoke the application's authorization from your TikTok or TikTok Shop
                  account settings if you no longer want the service to access approved shop
                  or account data.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="font-semibold text-slate-800">Facebook Integration</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Remove the application from your Facebook business or account settings to
                  revoke future access and trigger the connected cleanup flow where
                  supported.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Mail className="h-5 w-5 text-slate-700" />
              3. Additional Integration Data Requests
            </h2>
            <p className="text-sm leading-6 text-slate-600">
              For additional third-party integration data requests, contact support and
              identify the relevant workspace or integration. App account deletion uses
              the automated flow described above and does not require an email or support call.
            </p>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
              <p>
                Service website:{" "}
                <a
                  href={SERVICE_WEBSITE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-slate-900 underline underline-offset-2"
                >
                  {SERVICE_WEBSITE_URL}
                </a>
              </p>
              <p>
                Deletion instructions URL:{" "}
                <a
                  href={USER_DATA_DELETION_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-slate-900 underline underline-offset-2"
                >
                  {USER_DATA_DELETION_URL}
                </a>
              </p>
              <p>
                Contact email:{" "}
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="font-semibold text-slate-900 underline underline-offset-2"
                >
                  {SUPPORT_EMAIL}
                </a>
              </p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">4. Data Categories Eligible For Cleanup</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="font-semibold text-slate-800">Connection Credentials</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Access tokens, refresh tokens and related platform connection identifiers
                  associated with the revoked integration.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="font-semibold text-slate-800">Synchronized Operational Data</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Eligible synchronized records, temporary caches and related metadata that
                  are no longer required for lawful retention or system integrity.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
