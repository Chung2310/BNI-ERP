import React, { useEffect, useState } from "react";
import {
  Plus,
  Search,
  X,
  Download,
  Wallet,
  Bell,
  Settings2,
  RefreshCw,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Clock,
  CreditCard,
  Banknote,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  memberFeeService,
  type FeeMember,
  type MemberFee,
  type MemberFeeStatus,
  type ReceiveMemberFee,
} from "../../services/memberFeeService";
import { toast } from "../../pages/Toast";
import FeePaymentPanel from "./FeePaymentPanel";
import FeeSePaySettings from "./FeeSePaySettings";
const money = (amount: number) => amount.toLocaleString("vi-VN") + " ₫";
const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(
    new Date(),
  );
const labels: Record<MemberFeeStatus, string> = {
  unpaid: "Chưa đóng",
  partial: "Đóng một phần",
  overdue: "Quá hạn",
  paid: "Đã đóng đủ",
};
const statusConfig: Record<
  MemberFeeStatus,
  { bg: string; text: string; dot: string }
> = {
  unpaid: { bg: "bg-slate-100", text: "text-slate-600", dot: "bg-slate-400" },
  partial: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-400" },
  overdue: { bg: "bg-rose-50", text: "text-rose-700", dot: "bg-rose-500" },
  paid: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
  },
};
const inputClass =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition";
const dateText = (value: string) => value.split("-").reverse().join("/");
const newReceipt = (amount: number): ReceiveMemberFee => ({
  id: crypto.randomUUID(),
  amount,
  paidOn: today(),
  method: "transfer",
  reference: "",
  note: "",
});
export default function MemberFeesTab() {
  const { userProfile } = useAuth();
  const canManage = userProfile?.role === "admin";
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sendingAll, setSendingAll] = useState(false);
  const [sendProgress, setSendProgress] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [items, setItems] = useState<MemberFee[]>([]);
  const [members, setMembers] = useState<FeeMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<MemberFeeStatus | "all">("all");
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("Phí thường niên");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [memberQuery, setMemberQuery] = useState("");
  const [active, setActive] = useState<MemberFee | null>(null);
  const [receipt, setReceipt] = useState<ReceiveMemberFee | null>(null);
  const [voidId, setVoidId] = useState("");
  const [voidReason, setVoidReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setItems([]);
    Promise.all([
      memberFeeService.list(year, controller.signal),
      canManage
        ? memberFeeService.members(controller.signal)
        : Promise.resolve([]),
    ])
      .then(([fees, people]) => {
        setItems(fees);
        setMembers(people);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [year, reload, canManage]);
  const filtered = items.filter(
    (item) =>
      (status === "all" || item.status === status) &&
      [item.memberName, item.memberEmail, item.title]
        .join(" ")
        .toLocaleLowerCase("vi")
        .includes(query.toLocaleLowerCase("vi")),
  );
  const memberOptions = members.filter((member) =>
    (member.name + " " + member.email)
      .toLocaleLowerCase("vi")
      .includes(memberQuery.toLocaleLowerCase("vi")),
  );
  const totals = items.reduce(
    (sum, item) => ({
      amount: sum.amount + item.amount,
      paid: sum.paid + item.paid,
      remaining: sum.remaining + item.remaining,
    }),
    { amount: 0, paid: 0, remaining: 0 },
  );
  const openCreate = () => {
    setTitle("Phí thường niên");
    setAmount("");
    setDueDate(year + "-12-31");
    setNote("");
    setSelected([]);
    setMemberQuery("");
    setFormError("");
    setCreating(true);
  };
  const openDetail = (item: MemberFee) => {
    setActive(item);
    setReceipt(newReceipt(item.remaining));
    setVoidId("");
    setVoidReason("");
    setFormError("");
  };
  useEffect(() => {
    let alive = true;
    const openFromUrl = async () => {
      const id = new URL(window.location.href).searchParams.get("fee");
      if (!id) return;
      try {
        const fee = await memberFeeService.get(id);
        if (alive) {
          setYear(fee.year);
          openDetail(fee);
        }
      } catch (e: any) {
        if (alive) setError(e.message);
      }
    };
    void openFromUrl();
    window.addEventListener("popstate", openFromUrl);
    return () => {
      alive = false;
      window.removeEventListener("popstate", openFromUrl);
    };
  }, []);
  const closeDetail = () => {
    setActive(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("fee");
    window.history.replaceState(null, "", url);
  };
  const notifyVisible = async () => {
    if (sendingAll) return;
    const targets = filtered.filter((f) => f.remaining > 0);
    setSendingAll(true);
    setSendProgress("");
    let sent = 0;
    let failed = 0;
    let failure = "";
    for (const fee of targets) {
      try {
        await memberFeeService.notify(fee._id);
        sent++;
      } catch (e: any) {
        failed++;
        failure = e.message;
      }
      setSendProgress("Đang gửi " + (sent + failed) + "/" + targets.length);
    }
    setSendingAll(false);
    setReload((v) => v + 1);
    setSendProgress(
      "Đã gửi " +
        sent +
        " khoản" +
        (failed
          ? "; " + failed + " khoản lỗi: " + failure
          : ". Thông báo đã gửi hôm nay sẽ không bị gửi trùng."),
    );
  };
  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (!selected.length) {
      setFormError("Chọn ít nhất một thành viên.");
      return;
    }
    setBusy(true);
    setFormError("");
    try {
      const result = await memberFeeService.create({
        year,
        title,
        amount: Number(amount),
        dueDate,
        note,
        memberIds: selected,
      });
      toast.success(
        "Đã tạo " +
          result.created +
          " khoản phải đóng" +
          (result.skipped
            ? "; bỏ qua " + result.skipped + " khoản đã tồn tại."
            : "."),
      );
      setCreating(false);
      setReload((value) => value + 1);
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const refreshDetail = async () => {
    if (!active || busy) return;
    setBusy(true);
    setFormError("");
    try {
      const updated = await memberFeeService.get(active._id);
      setActive(updated);
      setReceipt(newReceipt(updated.remaining));
      setVoidId("");
      setItems((old) =>
        old.map((item) => (item._id === updated._id ? updated : item)),
      );
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const receive = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!active || !receipt || busy) return;
    setBusy(true);
    setFormError("");
    try {
      const updated = await memberFeeService.receive(active._id, receipt);
      setActive(updated);
      setReceipt(newReceipt(updated.remaining));
      setItems((old) =>
        old.map((item) => (item._id === updated._id ? updated : item)),
      );
      toast.success("Đã ghi nhận phiếu thu.");
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const voidPayment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!active || !voidId || busy) return;
    setBusy(true);
    setFormError("");
    try {
      const updated = await memberFeeService.voidPayment(
        active._id,
        voidId,
        voidReason,
      );
      setActive(updated);
      setReceipt(newReceipt(updated.remaining));
      setVoidId("");
      setVoidReason("");
      setItems((old) =>
        old.map((item) => (item._id === updated._id ? updated : item)),
      );
      toast.success("Đã hủy phiếu thu và cập nhật số còn phải đóng.");
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const exportCsv = () => {
    const cell = (value: unknown) => {
      const raw = String(value ?? "");
      return (
        '"' +
        (/^[=+@\-\t\r]/.test(raw) ? "'" + raw : raw).replace(/"/g, '""') +
        '"'
      );
    };
    const rows: unknown[][] = [
      [
        "Thành viên",
        "Email",
        "Năm",
        "Khoản phí",
        "Hạn đóng",
        "Phải đóng (VND)",
        "Đã đóng (VND)",
        "Còn thiếu (VND)",
        "Trạng thái",
      ],
      ...filtered.map((item) => [
        item.memberName,
        item.memberEmail,
        item.year,
        item.title,
        item.dueDate,
        item.amount,
        item.paid,
        item.remaining,
        labels[item.status],
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob(
        ["\uFEFF" + rows.map((row) => row.map(cell).join(",")).join("\r\n")],
        { type: "text/csv;charset=utf-8;" },
      ),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "phi-thuong-nien-" + year + ".csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const statCards = [
    {
      label: "Tổng phải đóng",
      value: totals.amount,
      Icon: TrendingUp,
      iconBg: "bg-indigo-50",
      iconColor: "text-indigo-600",
      border: "border-l-indigo-400",
    },
    {
      label: "Đã thu được",
      value: totals.paid,
      Icon: CheckCircle2,
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-600",
      border: "border-l-emerald-400",
    },
    {
      label: "Còn phải đóng",
      value: totals.remaining,
      Icon: AlertCircle,
      iconBg: "bg-rose-50",
      iconColor: "text-rose-500",
      border: "border-l-rose-400",
    },
  ];
  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50">
      {" "}
      {/* Page Header */}{" "}
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur-sm px-4 py-4 sm:px-6">
        {" "}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {" "}
          <div className="flex items-center gap-3">
            {" "}
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-600 shadow-md shadow-cyan-200">
              {" "}
              <Wallet className="h-5 w-5 text-white" />{" "}
            </div>{" "}
            <div>
              {" "}
              <h2 className="text-base font-bold text-slate-900">
                Phí thường niên
              </h2>{" "}
              <p className="text-xs text-slate-500">
                Theo dõi khoản phải đóng và lịch sử thu của thành viên
              </p>{" "}
            </div>{" "}
          </div>{" "}
          <div className="flex flex-wrap items-center gap-2">
            {" "}
            {canManage && (
              <button
                onClick={() => setSettingsOpen(true)}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 cursor-pointer"
              >
                {" "}
                <Settings2 className="h-3.5 w-3.5" />
                SePay &amp; giao dịch{" "}
              </button>
            )}{" "}
            <button
              disabled={loading || !filtered.length}
              onClick={exportCsv}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
            >
              {" "}
              <Download className="h-3.5 w-3.5" />
              Xuất CSV{" "}
            </button>{" "}
            {canManage && (
              <button
                onClick={openCreate}
                disabled={loading || !!error}
                className="flex items-center gap-1.5 rounded-xl bg-cyan-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-cyan-700 disabled:opacity-40 transition cursor-pointer"
              >
                {" "}
                <Plus className="h-3.5 w-3.5" />
                Tạo khoản phí{" "}
              </button>
            )}{" "}
          </div>{" "}
        </div>{" "}
      </div>{" "}
      <div className="space-y-5 p-4 sm:p-6">
        {" "}
        {settingsOpen && (
          <FeeSePaySettings onClose={() => setSettingsOpen(false)} />
        )}{" "}
        {/* Notify bar */}{" "}
        {canManage && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-3">
            {" "}
            <Bell className="h-4 w-4 shrink-0 text-cyan-600" />{" "}
            <button
              disabled={
                sendingAll || loading || !filtered.some((f) => f.remaining > 0)
              }
              onClick={() => void notifyVisible()}
              className="rounded-xl border border-cyan-200 bg-white px-3 py-1.5 text-xs font-semibold text-cyan-800 transition hover:bg-cyan-50 disabled:opacity-40 cursor-pointer"
            >
              {" "}
              {sendingAll ? (
                <span className="flex items-center gap-1.5">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Đang gửi...
                </span>
              ) : (
                "Gửi thông báo & QR cho danh sách đang lọc"
              )}{" "}
            </button>{" "}
            {sendProgress && (
              <span role="status" className="text-xs text-cyan-700">
                {sendProgress}
              </span>
            )}{" "}
          </div>
        )}{" "}
        {/* Stat Cards */}{" "}
        <div className="grid gap-4 sm:grid-cols-3">
          {" "}
          {statCards.map((card) => (
            <div
              key={card.label}
              className={`rounded-2xl border border-slate-200 border-l-4 bg-white p-5 shadow-xs ${card.border}`}
            >
              {" "}
              <div className="flex items-start justify-between">
                {" "}
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {card.label} · {year}
                </p>{" "}
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-xl ${card.iconBg}`}
                >
                  {" "}
                  <card.Icon className={`h-4 w-4 ${card.iconColor}`} />{" "}
                </div>{" "}
              </div>{" "}
              <p className="mt-3 text-2xl font-bold text-slate-900 font-mono">
                {" "}
                {loading ? (
                  <span className="inline-block h-7 w-32 animate-pulse rounded-lg bg-slate-100" />
                ) : (
                  money(card.value)
                )}{" "}
              </p>{" "}
            </div>
          ))}{" "}
        </div>{" "}
        {/* Filters */}{" "}
        <div className="flex flex-wrap items-end gap-3">
          {" "}
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
            {" "}
            Năm{" "}
            <select
              aria-label="Năm thu phí"
              value={year}
              onChange={(e) => setYear(+e.target.value)}
              className={inputClass}
              style={{ minWidth: 92 }}
            >
              {" "}
              {Array.from({ length: 101 }, (_, i) => 2000 + i).map((y) => (
                <option key={y}>{y}</option>
              ))}{" "}
            </select>{" "}
          </label>{" "}
          <label className="min-w-[240px] flex-1 text-xs font-bold uppercase tracking-wider text-slate-500">
            {" "}
            Tìm thành viên hoặc khoản phí{" "}
            <div className="relative mt-1">
              {" "}
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />{" "}
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3.5 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
                placeholder="Họ tên, email, tên khoản phí"
              />{" "}
            </div>{" "}
          </label>{" "}
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
            {" "}
            Trạng thái{" "}
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              className={inputClass}
              style={{ minWidth: 155 }}
            >
              {" "}
              <option value="all">Tất cả</option>{" "}
              {Object.entries(labels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}{" "}
            </select>{" "}
          </label>{" "}
        </div>{" "}
        {/* Table */}{" "}
        {error ? (
          <div
            role="alert"
            className="flex items-center gap-3 rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700"
          >
            {" "}
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>{" "}
            <button
              onClick={() => setReload((v) => v + 1)}
              className="ml-auto rounded-lg border border-rose-200 bg-white px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 cursor-pointer"
            >
              Thử lại
            </button>{" "}
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            {" "}
            <RefreshCw className="h-8 w-8 animate-spin text-cyan-600 mb-3" />{" "}
            <p className="text-sm font-semibold text-slate-500">
              Đang tải khoản phí...
            </p>{" "}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
            {" "}
            <div className="overflow-x-auto">
              {" "}
              <table className="w-full min-w-[880px] text-left text-sm">
                {" "}
                <thead>
                  {" "}
                  <tr className="border-b border-slate-100 bg-slate-50/80">
                    {" "}
                    {[
                      "Thành viên",
                      "Khoản phí",
                      "Hạn đóng",
                      "Phải đóng",
                      "Đã đóng",
                      "Còn thiếu",
                      "Trạng thái",
                      "",
                    ].map((label, i) => (
                      <th
                        key={i}
                        className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500"
                      >
                        {label}
                      </th>
                    ))}{" "}
                  </tr>{" "}
                </thead>{" "}
                <tbody className="divide-y divide-slate-100">
                  {" "}
                  {filtered.map((item) => {
                    const sc = statusConfig[item.status];
                    return (
                      <tr
                        key={item._id}
                        className="transition-colors hover:bg-slate-50/70"
                      >
                        {" "}
                        <td className="px-4 py-3">
                          {" "}
                          <div className="flex items-center gap-2.5">
                            {" "}
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-xs font-bold text-indigo-700 uppercase">
                              {" "}
                              {(item.memberName || "?").slice(0, 2)}{" "}
                            </div>{" "}
                            <div>
                              {" "}
                              <p className="font-semibold text-slate-800">
                                {item.memberName}
                              </p>{" "}
                              <p className="text-[11px] font-mono text-slate-400">
                                {item.memberEmail}
                              </p>{" "}
                            </div>{" "}
                          </div>{" "}
                        </td>{" "}
                        <td className="px-4 py-3 font-medium text-slate-700">
                          {item.title}
                        </td>{" "}
                        <td className="whitespace-nowrap px-4 py-3">
                          {" "}
                          <div className="flex items-center gap-1.5 text-slate-600">
                            <Clock className="h-3.5 w-3.5 text-slate-400" />
                            {dateText(item.dueDate)}
                          </div>{" "}
                        </td>{" "}
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-slate-700">
                          {money(item.amount)}
                        </td>{" "}
                        <td className="whitespace-nowrap px-4 py-3 font-mono font-semibold text-emerald-700">
                          {money(item.paid)}
                        </td>{" "}
                        <td className="whitespace-nowrap px-4 py-3 font-mono font-bold text-slate-900">
                          {money(item.remaining)}
                        </td>{" "}
                        <td className="px-4 py-3">
                          {" "}
                          <span
                            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${sc.bg} ${sc.text}`}
                          >
                            {" "}
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${sc.dot}`}
                            />
                            {labels[item.status]}{" "}
                          </span>{" "}
                        </td>{" "}
                        <td className="px-4 py-3">
                          {" "}
                          <button
                            onClick={() => openDetail(item)}
                            className="flex items-center gap-1 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 cursor-pointer whitespace-nowrap"
                          >
                            {" "}
                            {item.remaining > 0 ? "Thanh toán" : "Chi tiết"}
                            <ChevronRight className="h-3.5 w-3.5" />{" "}
                          </button>{" "}
                        </td>{" "}
                      </tr>
                    );
                  })}{" "}
                  {!filtered.length && (
                    <tr>
                      <td
                        colSpan={8}
                        className="py-14 text-center text-sm text-slate-400"
                      >
                        {items.length
                          ? "Không có khoản phí phù hợp với bộ lọc."
                          : "Chưa có khoản phí trong năm này."}
                      </td>
                    </tr>
                  )}{" "}
                </tbody>{" "}
              </table>{" "}
            </div>{" "}
          </div>
        )}{" "}
      </div>{" "}
      {/* Modal: Tạo khoản phí */}{" "}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          {" "}
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-fee-title"
            className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl"
          >
            {" "}
            <div className="flex items-center justify-between bg-cyan-600 px-6 py-5 rounded-t-3xl">
              {" "}
              <div className="flex items-center gap-3">
                {" "}
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-cyan-600">
                  <Plus className="h-4 w-4 text-white" />
                </div>{" "}
                <div>
                  {" "}
                  <h3 id="create-fee-title" className="font-bold text-white">
                    Tạo khoản phí năm {year}
                  </h3>{" "}
                  <p className="text-xs text-slate-400">
                    Điền thông tin và chọn thành viên áp dụng
                  </p>{" "}
                </div>{" "}
              </div>{" "}
              <button
                aria-label="Đóng"
                disabled={busy}
                onClick={() => setCreating(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-cyan-700 hover:text-white transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>{" "}
            </div>{" "}
            <form onSubmit={create} className="p-6 space-y-5">
              {" "}
              <fieldset disabled={busy} className="space-y-4">
                {" "}
                <div>
                  {" "}
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Tên khoản phí <span className="text-rose-500">*</span>
                  </label>{" "}
                  <input
                    required
                    minLength={2}
                    maxLength={150}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className={inputClass}
                  />{" "}
                </div>{" "}
                <div className="grid gap-4 sm:grid-cols-2">
                  {" "}
                  <div>
                    {" "}
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Số tiền mỗi thành viên (VND){" "}
                      <span className="text-rose-500">*</span>
                    </label>{" "}
                    <input
                      required
                      aria-label="Số tiền mỗi thành viên (VND)"
                      type="number"
                      min={1}
                      max={1000000000000}
                      step={1}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className={inputClass}
                      placeholder="1000000"
                    />{" "}
                  </div>{" "}
                  <div>
                    {" "}
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Hạn đóng <span className="text-rose-500">*</span>
                    </label>{" "}
                    <input
                      required
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className={inputClass}
                    />{" "}
                  </div>{" "}
                </div>{" "}
                <div>
                  {" "}
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Ghi chú
                  </label>{" "}
                  <textarea
                    maxLength={1000}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className={inputClass}
                    rows={2}
                  />{" "}
                </div>{" "}
                <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
                  {" "}
                  <div className="flex items-center justify-between">
                    {" "}
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Thành viên áp dụng
                    </span>{" "}
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700">
                      {selected.length} đã chọn
                    </span>{" "}
                  </div>{" "}
                  <div className="relative">
                    {" "}
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />{" "}
                    <input
                      aria-label="Tìm thành viên áp dụng"
                      placeholder="Tìm tên hoặc email"
                      value={memberQuery}
                      onChange={(e) => setMemberQuery(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3.5 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
                    />{" "}
                  </div>{" "}
                  <div className="flex gap-3 text-[11px]">
                    {" "}
                    <button
                      type="button"
                      onClick={() =>
                        setSelected((old) => [
                          ...new Set([
                            ...old,
                            ...memberOptions.map((m) => m.id),
                          ]),
                        ])
                      }
                      className="font-semibold text-cyan-700 hover:underline cursor-pointer"
                    >
                      Chọn tất cả đang hiển thị
                    </button>{" "}
                    <button
                      type="button"
                      onClick={() => setSelected([])}
                      className="font-semibold text-slate-500 hover:underline cursor-pointer"
                    >
                      Bỏ chọn tất cả
                    </button>{" "}
                  </div>{" "}
                  <div className="max-h-52 space-y-1 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50 p-2">
                    {" "}
                    {memberOptions.map((member) => (
                      <label
                        key={member.id}
                        className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-white transition cursor-pointer"
                      >
                        {" "}
                        <input
                          type="checkbox"
                          checked={selected.includes(member.id)}
                          onChange={(e) =>
                            setSelected((old) =>
                              e.target.checked
                                ? [...old, member.id]
                                : old.filter((id) => id !== member.id),
                            )
                          }
                          className="accent-cyan-600"
                        />{" "}
                        <div>
                          <span className="font-semibold text-slate-800">
                            {member.name}
                          </span>
                          <span className="ml-2 text-xs font-mono text-slate-400">
                            {member.email}
                          </span>
                        </div>{" "}
                      </label>
                    ))}{" "}
                    {!memberOptions.length && (
                      <p className="p-4 text-center text-sm text-slate-400">
                        Không có thành viên phù hợp.
                      </p>
                    )}{" "}
                  </div>{" "}
                </div>{" "}
                <p className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-xs text-slate-500">
                  Khoản phí cùng tên, cùng năm của một thành viên chỉ được tạo
                  một lần. Khoản đã có sẽ được bỏ qua.
                </p>{" "}
              </fieldset>{" "}
              {formError && (
                <p
                  role="alert"
                  className="rounded-xl bg-rose-50 border border-rose-100 p-3 text-sm text-rose-700"
                >
                  {formError}
                </p>
              )}{" "}
              <div className="flex gap-3 pt-1">
                {" "}
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  Hủy bỏ
                </button>{" "}
                <button
                  disabled={busy || !selected.length || selected.length > 1000}
                  className="flex-1 rounded-xl bg-cyan-600 py-2.5 text-sm font-bold text-white hover:bg-cyan-700 disabled:opacity-50 transition cursor-pointer"
                >
                  {" "}
                  {busy ? (
                    <span className="flex items-center justify-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Đang tạo...
                    </span>
                  ) : (
                    `Tạo cho ${selected.length} thành viên`
                  )}{" "}
                </button>{" "}
              </div>{" "}
            </form>{" "}
          </section>{" "}
        </div>
      )}{" "}
      {/* Modal: Chi tiết / Thanh toán */}{" "}
      {active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          {" "}
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="fee-detail-title"
            className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl"
          >
            {" "}
            <div className="bg-cyan-600 px-6 py-5 rounded-t-3xl">
              {" "}
              <div className="flex items-start justify-between gap-3">
                {" "}
                <div className="flex items-center gap-3">
                  {" "}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-sm font-bold text-white uppercase">
                    {(active.memberName || "?").slice(0, 2)}
                  </div>{" "}
                  <div>
                    {" "}
                    <h3 id="fee-detail-title" className="font-bold text-white">
                      {active.memberName}
                    </h3>{" "}
                    <p className="text-xs text-slate-400">
                      {active.title} · {active.year} · Hạn:{" "}
                      {dateText(active.dueDate)}
                    </p>{" "}
                  </div>{" "}
                </div>{" "}
                <button
                  aria-label="Đóng"
                  disabled={busy}
                  onClick={closeDetail}
                  className="rounded-xl p-2 text-slate-400 hover:bg-cyan-700 hover:text-white transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>{" "}
              </div>{" "}
              <div className="mt-4 grid grid-cols-3 gap-3">
                {" "}
                {[
                  {
                    label: "Phải đóng",
                    value: active.amount,
                    color: "text-slate-200",
                  },
                  {
                    label: "Đã đóng",
                    value: active.paid,
                    color: "text-emerald-400",
                  },
                  {
                    label: "Còn thiếu",
                    value: active.remaining,
                    color: "text-rose-400",
                  },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3"
                  >
                    {" "}
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                      {s.label}
                    </p>{" "}
                    <p
                      className={`mt-1 text-sm font-bold font-mono ${s.color}`}
                    >
                      {money(s.value)}
                    </p>{" "}
                  </div>
                ))}{" "}
              </div>{" "}
              <button
                type="button"
                disabled={busy}
                onClick={() => void refreshDetail()}
                className="mt-3 flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition cursor-pointer"
              >
                {" "}
                <RefreshCw
                  className={`h-3 w-3 ${busy ? "animate-spin" : ""}`}
                />
                Cập nhật dữ liệu{" "}
              </button>{" "}
            </div>{" "}
            <div className="p-6 space-y-6">
              {" "}
              <FeePaymentPanel
                id={active._id}
                canManage={canManage}
                onUpdate={(updated) => {
                  setActive(updated);
                  setItems((old) =>
                    old.map((item) =>
                      item._id === updated._id ? updated : item,
                    ),
                  );
                }}
              />{" "}
              {active.note && (
                <p className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-sm text-slate-500 whitespace-pre-wrap">
                  {active.note}
                </p>
              )}{" "}
              {canManage && active.remaining > 0 && receipt && !voidId && (
                <form
                  onSubmit={receive}
                  className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-5 space-y-4"
                >
                  {" "}
                  <h4 className="flex items-center gap-2 font-bold text-slate-800">
                    <CreditCard className="h-4 w-4 text-indigo-600" />
                    Ghi nhận tiền đã thu
                  </h4>{" "}
                  <fieldset
                    disabled={busy}
                    className="grid gap-4 sm:grid-cols-2"
                  >
                    {" "}
                    <div>
                      {" "}
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                        Số tiền thu (VND){" "}
                        <span className="text-rose-500">*</span>
                      </label>{" "}
                      <input
                        required
                        aria-label="Số tiền thu (VND)"
                        type="number"
                        min={1}
                        max={active.remaining}
                        step={1}
                        value={receipt.amount || ""}
                        onChange={(e) =>
                          setReceipt({ ...receipt, amount: +e.target.value })
                        }
                        className={inputClass}
                      />{" "}
                    </div>{" "}
                    <div>
                      {" "}
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                        Ngày thu <span className="text-rose-500">*</span>
                      </label>{" "}
                      <input
                        required
                        type="date"
                        max={today()}
                        value={receipt.paidOn}
                        onChange={(e) =>
                          setReceipt({ ...receipt, paidOn: e.target.value })
                        }
                        className={inputClass}
                      />{" "}
                    </div>{" "}
                    <div>
                      {" "}
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                        Hình thức
                      </label>{" "}
                      <select
                        value={receipt.method}
                        onChange={(e) =>
                          setReceipt({
                            ...receipt,
                            method: e.target.value as "cash" | "transfer",
                          })
                        }
                        className={inputClass}
                      >
                        {" "}
                        <option value="transfer">Chuyển khoản</option>
                        <option value="cash">Tiền mặt</option>{" "}
                      </select>{" "}
                    </div>{" "}
                    <div>
                      {" "}
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                        Mã giao dịch / số phiếu
                      </label>{" "}
                      <input
                        maxLength={150}
                        value={receipt.reference}
                        onChange={(e) =>
                          setReceipt({ ...receipt, reference: e.target.value })
                        }
                        className={inputClass}
                      />{" "}
                    </div>{" "}
                    <div className="sm:col-span-2">
                      {" "}
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                        Ghi chú phiếu thu
                      </label>{" "}
                      <input
                        maxLength={1000}
                        value={receipt.note}
                        onChange={(e) =>
                          setReceipt({ ...receipt, note: e.target.value })
                        }
                        className={inputClass}
                      />{" "}
                    </div>{" "}
                  </fieldset>{" "}
                  <button
                    disabled={busy}
                    className="flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-cyan-700 disabled:opacity-50 transition cursor-pointer"
                  >
                    {" "}
                    {busy ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Banknote className="h-4 w-4" />
                    )}
                    {busy ? "Đang lưu..." : "Lưu phiếu thu"}{" "}
                  </button>{" "}
                </form>
              )}{" "}
              {voidId && (
                <form
                  onSubmit={voidPayment}
                  className="rounded-2xl border border-rose-200 bg-rose-50 p-5 space-y-3"
                >
                  {" "}
                  <h4 className="font-bold text-rose-800">
                    Hủy phiếu thu
                  </h4>{" "}
                  <div>
                    {" "}
                    <label className="block text-xs font-bold uppercase tracking-wider text-rose-600 mb-1">
                      Lý do hủy <span className="text-rose-500">*</span>
                    </label>{" "}
                    <input
                      required
                      minLength={3}
                      maxLength={500}
                      disabled={busy}
                      value={voidReason}
                      onChange={(e) => setVoidReason(e.target.value)}
                      className={inputClass}
                    />{" "}
                  </div>{" "}
                  <p className="text-xs text-rose-600">
                    Số tiền sẽ được cộng lại vào khoản còn phải đóng. Lịch sử
                    vẫn được giữ.
                  </p>{" "}
                  <div className="flex gap-3">
                    {" "}
                    <button
                      disabled={busy}
                      className="rounded-xl bg-rose-700 px-4 py-2 text-sm font-bold text-white hover:bg-rose-800 transition cursor-pointer"
                    >
                      Xác nhận hủy
                    </button>{" "}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setVoidId("")}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                    >
                      Bỏ qua
                    </button>{" "}
                  </div>{" "}
                </form>
              )}{" "}
              {formError && (
                <p
                  role="alert"
                  className="rounded-xl bg-rose-50 border border-rose-100 p-3 text-sm text-rose-700"
                >
                  {formError}
                </p>
              )}{" "}
              <div>
                {" "}
                <h4 className="mb-3 flex items-center gap-2 font-bold text-slate-800">
                  <Clock className="h-4 w-4 text-slate-400" />
                  Lịch sử thu ({active.payments.length})
                </h4>{" "}
                <div className="space-y-3">
                  {" "}
                  {[...active.payments].reverse().map((payment) => (
                    <article
                      key={payment.id}
                      className={`rounded-2xl border p-4 text-sm ${payment.voidedAt ? "bg-slate-50 border-slate-100 opacity-60" : "bg-white border-slate-100"}`}
                    >
                      {" "}
                      <div className="flex items-center justify-between gap-2">
                        {" "}
                        <span
                          className={`font-bold text-base font-mono ${payment.voidedAt ? "line-through text-slate-400" : "text-slate-800"}`}
                        >
                          {money(payment.amount)}
                        </span>{" "}
                        <span className="text-xs text-slate-400">
                          {dateText(payment.paidOn)} ·{" "}
                          {payment.method === "cash"
                            ? "Tiền mặt"
                            : "Chuyển khoản"}
                        </span>{" "}
                      </div>{" "}
                      {payment.reference && (
                        <p className="mt-1 text-xs text-slate-500 font-mono">
                          Mã: {payment.reference}
                        </p>
                      )}{" "}
                      {payment.note && (
                        <p className="mt-1 text-xs text-slate-500 whitespace-pre-wrap">
                          {payment.note}
                        </p>
                      )}{" "}
                      <p className="mt-2 text-[11px] text-slate-400">
                        Ghi nhận lúc{" "}
                        {new Date(payment.recordedAt).toLocaleString("vi-VN")}
                      </p>{" "}
                      {payment.voidedAt ? (
                        <p className="mt-2 text-xs font-semibold text-rose-600">
                          Đã hủy: {payment.voidReason}
                        </p>
                      ) : (
                        canManage &&
                        payment.recordedBy !== "sepay" && (
                          <button
                            disabled={busy}
                            onClick={() => {
                              setVoidId(payment.id);
                              setVoidReason("");
                              setFormError("");
                            }}
                            className="mt-2 rounded-lg border border-rose-100 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                          >
                            {" "}
                            Hủy phiếu thu này{" "}
                          </button>
                        )
                      )}{" "}
                    </article>
                  ))}{" "}
                  {!active.payments.length && (
                    <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
                      Chưa ghi nhận phiếu thu.
                    </p>
                  )}{" "}
                </div>{" "}
              </div>{" "}
            </div>{" "}
          </section>{" "}
        </div>
      )}{" "}
    </div>
  );
}
