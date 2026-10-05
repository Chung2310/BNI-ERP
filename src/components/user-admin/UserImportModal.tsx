import React, { useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Download,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Info,
} from "lucide-react";
import { parseUserImportExcel, downloadUserImportTemplate } from "../../utils/userImportExcel";
import { submitUserImport, type UserImportRow, type UserImportResultRow } from "../../services/userImportService";

const statusStyle: Record<UserImportResultRow["status"], { bg: string; text: string; dot: string }> = {
  valid:   { bg: "bg-indigo-50",  text: "text-indigo-700",  dot: "bg-indigo-400"  },
  created: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  skipped: { bg: "bg-slate-100",  text: "text-slate-600",   dot: "bg-slate-400"   },
  error:   { bg: "bg-rose-50",    text: "text-rose-700",    dot: "bg-rose-500"    },
};

const statusLabel: Record<UserImportResultRow["status"], string> = {
  valid: "Hợp lệ",
  created: "Đã tạo",
  skipped: "Bỏ qua",
  error: "Lỗi",
};

export default function UserImportModal({
  onClose,
  onComplete,
}: {
  onClose: () => void;
  onComplete: () => void | Promise<void>;
}) {
  const [rows, setRows] = useState<UserImportRow[]>([]);
  const [results, setResults] = useState<UserImportResultRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");

  const validCount = results.filter((row) => row.status === "valid").length;

  const preview = async (data: UserImportRow[]) => {
    const result = await submitUserImport(data, true);
    setResults(result.rows);
  };

  const chooseFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setRows([]);
    setResults([]);
    setError("");
    setProgress("");
    setFileName(file.name);
    setBusy(true);

    try {
      if (!/\.(xlsx|xls)$/i.test(file.name)) throw new Error("Vui lòng chọn file .xlsx hoặc .xls.");
      if (file.size > 5 * 1024 * 1024) throw new Error("File Excel tối đa 5 MB.");
      const data = parseUserImportExcel(await file.arrayBuffer());
      setRows(data);
      await preview(data);
    } catch (e) {
      setError(e.message || "Không thể đọc file Excel.");
    } finally {
      setBusy(false);
    }
  };

  const recheck = async () => {
    setBusy(true);
    setError("");
    setProgress("");
    try {
      await preview(rows);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    const accepted = new Set(
      results.filter((row) => row.status === "valid").map((row) => row.rowNumber)
    );
    const pending = rows.filter((row) => accepted.has(row.rowNumber));
    setBusy(true);
    setError("");

    try {
      for (let offset = 0; offset < pending.length; offset += 20) {
        const batch = pending.slice(offset, offset + 20);
        setProgress(`Đang nhập ${Math.min(offset + 20, pending.length)}/${pending.length} tài khoản...`);
        const result = await submitUserImport(batch, false);
        const changes = new Map(result.rows.map((row) => [row.rowNumber, row]));
        setResults((old) => old.map((row) => changes.get(row.rowNumber) || row));
      }
      setProgress("Đã xử lý xong. Xem kết quả từng dòng bên dưới.");
    } catch (e) {
      setError((e.message || "Kết nối bị gián đoạn.") + " Một số tài khoản có thể đã được tạo. Bấm Kiểm tra lại trước khi nhập tiếp.");
    } finally {
      setBusy(false);
      void onComplete();
    }
  };

  const summaryStats = [
    { label: "Hợp lệ",  value: validCount,                                         bg: "bg-indigo-50",  text: "text-indigo-700"  },
    { label: "Đã tạo",  value: results.filter((r) => r.status === "created").length, bg: "bg-emerald-50", text: "text-emerald-700" },
    { label: "Bỏ qua",  value: results.filter((r) => r.status === "skipped").length, bg: "bg-slate-100",  text: "text-slate-600"   },
    { label: "Lỗi",     value: results.filter((r) => r.status === "error").length,   bg: "bg-rose-50",    text: "text-rose-700"    },
  ];

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-import-title"
        className="flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between bg-cyan-600 px-6 py-5 rounded-t-3xl shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-500">
              <FileSpreadsheet className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 id="user-import-title" className="font-bold text-white">Nhập tài khoản từ Excel</h2>
              <p className="text-xs text-cyan-100">Tạo hàng loạt tài khoản Member từ file .xlsx / .xls</p>
            </div>
          </div>
          <button
            aria-label="Đóng popup nhập tài khoản"
            disabled={busy}
            onClick={onClose}
            className="rounded-xl p-2 text-cyan-100 hover:bg-cyan-700 hover:text-white transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-6 space-y-5 flex-1">
          {/* Info card */}
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 flex gap-3">
            <Info className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
            <div className="space-y-1 text-sm text-indigo-800">
              <p>Tài khoản mới có vai trò <strong>Member</strong>, mật khẩu mặc định <strong>123456</strong>. Đăng nhập bằng Email. Dữ liệu nhập vào đơn vị và chi nhánh đang chọn.</p>
              <p className="text-indigo-600 text-xs">Tối đa 200 dòng · 5 MB · Đọc sheet đầu tiên · Bắt buộc: Họ tên, Email · Thay dòng ví dụ bằng dữ liệu thực tế.</p>
            </div>
          </div>

          {/* Actions row */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              disabled={busy}
              onClick={downloadUserImportTemplate}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-40 cursor-pointer"
            >
              <Download className="h-4 w-4" />
              Tải file mẫu
            </button>

            <label className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition cursor-pointer ${busy ? "bg-slate-400 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700"}`}>
              <Upload className="h-4 w-4" />
              Chọn file Excel
              <input
                aria-label="Chọn file Excel"
                type="file"
                accept=".xlsx,.xls"
                disabled={busy}
                onChange={chooseFile}
                className="hidden"
              />
            </label>

            {rows.length > 0 && (
              <button
                disabled={busy}
                onClick={() => void recheck()}
                className="flex items-center gap-1.5 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-2.5 text-sm font-semibold text-cyan-800 hover:bg-cyan-100 transition disabled:opacity-40 cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
                Kiểm tra lại
              </button>
            )}
          </div>

          {/* File info */}
          {fileName && (
            <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5">
              <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />
              <span className="break-all font-medium text-slate-700">{fileName}</span>
              <span className="ml-auto shrink-0 text-slate-400">{rows.length} dòng</span>
            </div>
          )}

          {/* Progress / Loading */}
          {(busy || progress) && (
            <div className="flex items-center gap-2.5 rounded-xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm text-cyan-800">
              {busy && <RefreshCw className="h-4 w-4 animate-spin text-cyan-600 shrink-0" />}
              <span role="status">{progress || "Đang đọc và kiểm tra dữ liệu..."}</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Results */}
          {results.length > 0 && (
            <>
              {/* Summary stat cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {summaryStats.map((stat) => (
                  <div key={stat.label} className={`rounded-2xl border border-white/0 ${stat.bg} px-4 py-3`}>
                    <p className={`text-[11px] font-bold uppercase tracking-wider ${stat.text} opacity-70`}>{stat.label}</p>
                    <p className={`text-2xl font-bold mt-1 ${stat.text}`}>{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* Table */}
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[650px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/80">
                        {["Dòng", "Họ tên", "Email", "Điện thoại", "Kết quả"].map((label) => (
                          <th key={label} className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {results.map((result) => {
                        const row = rows.find((item) => item.rowNumber === result.rowNumber);
                        const sc = statusStyle[result.status];
                        return (
                          <tr key={result.rowNumber} className="hover:bg-slate-50/60 transition-colors">
                            <td className="px-4 py-3 text-xs font-mono text-slate-400">{result.rowNumber}</td>
                            <td className="px-4 py-3 font-semibold text-slate-800">{row?.displayName}</td>
                            <td className="px-4 py-3 font-mono text-xs text-slate-600">{result.email}</td>
                            <td className="px-4 py-3 text-slate-500">{row?.phone || <span className="text-slate-300">—</span>}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-start gap-2">
                                <span className={`mt-0.5 inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${sc.bg} ${sc.text}`}>
                                  <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                                  {statusLabel[result.status]}
                                </span>
                                {result.message && (
                                  <span className={`text-xs ${sc.text} opacity-80`}>{result.message}</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-white px-6 py-4 rounded-b-3xl shrink-0">
          <p className="text-xs text-slate-400 hidden sm:block">
            {results.length > 0 ? `${results.length} dòng đã kiểm tra` : "Chọn file Excel để bắt đầu"}
          </p>
          <div className="flex gap-3 ml-auto">
            <button
              disabled={busy}
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition disabled:opacity-40 cursor-pointer"
            >
              Đóng
            </button>
            <button
              disabled={busy || !validCount || !!error}
              onClick={() => void commit()}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-40 transition cursor-pointer"
            >
              {busy ? (
                <><RefreshCw className="h-4 w-4 animate-spin" /> Đang xử lý...</>
              ) : (
                <><CheckCircle2 className="h-4 w-4" />Nhập {validCount} tài khoản hợp lệ</>
              )}
            </button>
          </div>
        </div>
      </section>
    </div>,
    document.body
  );
}
