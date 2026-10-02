import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Search,
  X,
  Download,
  Wallet,
  Bell,
  RefreshCw,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Clock,
  CreditCard,
  Banknote,
  ChevronRight,
  Users,
  Send,
  UserCheck,
  UserX,
  Check,
  Calendar,
  Trash2,
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
import { ConfirmDialog } from "../common/ConfirmDialog";
import FeePaymentPanel from "./FeePaymentPanel";
import FeeSePaySettings from "./FeeSePaySettings";
import PersonalMemberFees from "./PersonalMemberFees";

const money = (amount: number) => amount.toLocaleString("vi-VN") + " ₫";
const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(
    new Date(),
  );

const memberStatusLabels: Record<MemberFeeStatus, string> = {
  unpaid: "Chưa đóng",
  partial: "Đóng một phần",
  overdue: "Quá hạn",
  paid: "Đã đóng đủ",
};

const memberStatusConfig: Record<
  MemberFeeStatus,
  { bg: string; text: string; dot: string; border: string }
> = {
  unpaid: {
    bg: "bg-slate-100",
    text: "text-slate-700",
    dot: "bg-slate-400",
    border: "border-slate-200",
  },
  partial: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    dot: "bg-amber-400",
    border: "border-amber-200",
  },
  overdue: {
    bg: "bg-rose-50",
    text: "text-rose-700",
    dot: "bg-rose-500",
    border: "border-rose-200",
  },
  paid: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
    border: "border-emerald-200",
  },
};

const inputClass =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 transition";

const dateText = (value: string) => {
  if (!value) return "-";
  return value.split("-").reverse().join("/");
};

const normalizeTitle = (title: string) =>
  title.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("vi");

const newReceipt = (amount: number): ReceiveMemberFee => ({
  id: crypto.randomUUID(),
  amount,
  paidOn: today(),
  method: "transfer",
  reference: "",
  note: "",
});

export interface FeeCampaign {
  key: string;
  campaignId?: string;
  title: string;
  year: number;
  dueDate: string;
  amount: number;
  note: string;
  items: MemberFee[];
  totalMembers: number;
  paidMembers: number;
  unpaidMembers: number;
  partialMembers: number;
  overdueMembers: number;
  totalExpected: number;
  totalPaid: number;
  totalRemaining: number;
  percentagePaid: number;
  percentageMembers: number;
  status: "completed" | "in_progress" | "overdue";
}

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

  // Filters for campaign list
  const [query, setQuery] = useState("");
  const [campaignStatusFilter, setCampaignStatusFilter] = useState<
    "all" | "completed" | "in_progress" | "overdue"
  >("all");

  // Selected campaign for detail view
  const [selectedCampaignKey, setSelectedCampaignKey] = useState<string | null>(
    null,
  );

  // Filters inside campaign detail view
  const [memberFilterTab, setMemberFilterTab] = useState<
    "all" | "paid" | "unpaid"
  >("all");
  const [memberSearchQuery, setMemberSearchQuery] = useState("");

  // Create fee modal
  const [campaignId, setCampaignId] = useState<string | undefined>();
  const [addingMembers, setAddingMembers] = useState(false);
  const [existingMemberIds, setExistingMemberIds] = useState<string[]>([]);
  const [deleteTargets, setDeleteTargets] = useState<MemberFee[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("Phí thường niên");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [memberModalQuery, setMemberModalQuery] = useState("");

  // Member Payment / Detail Modal
  const [active, setActive] = useState<MemberFee | null>(null);
  const [receipt, setReceipt] = useState<ReceiveMemberFee | null>(null);
  const [voidId, setVoidId] = useState("");
  const [voidReason, setVoidReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  // Notification sending state for single member
  const [sendingMemberId, setSendingMemberId] = useState<string | null>(null);

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
        if (controller.signal.aborted) return;
        setItems(canManage ? fees : fees.filter((fee) => fee.memberId === userProfile?.uid));
        setMembers(people);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [year, reload, canManage, userProfile?.uid]);

  // Group items into campaigns
  const campaigns: FeeCampaign[] = useMemo(() => {
    const map = new Map<string, MemberFee[]>();
    for (const item of items) {
      const key = item.campaignId || `${item.year}_${normalizeTitle(item.title)}`;
      const list = map.get(key) || [];
      list.push(item);
      map.set(key, list);
    }

    const todayStr = today();
    const result: FeeCampaign[] = [];

    map.forEach((feeItems, key) => {
      const first = feeItems[0];
      const totalMembers = feeItems.length;
      const paidMembers = feeItems.filter(
        (m) => m.status === "paid" || m.remaining === 0,
      ).length;
      const unpaidMembers = feeItems.filter((m) => m.remaining > 0).length;
      const partialMembers = feeItems.filter(
        (m) => m.status === "partial",
      ).length;
      const overdueMembers = feeItems.filter(
        (m) => m.status === "overdue",
      ).length;

      const totalExpected = feeItems.reduce((sum, m) => sum + m.amount, 0);
      const totalPaid = feeItems.reduce((sum, m) => sum + m.paid, 0);
      const totalRemaining = feeItems.reduce((sum, m) => sum + m.remaining, 0);

      const percentagePaid =
        totalExpected > 0 ? Math.round((totalPaid / totalExpected) * 100) : 0;
      const percentageMembers =
        totalMembers > 0
          ? Math.round((paidMembers / totalMembers) * 100)
          : 0;

      let status: "completed" | "in_progress" | "overdue" = "in_progress";
      if (totalRemaining === 0) {
        status = "completed";
      } else if (first.dueDate < todayStr) {
        status = "overdue";
      }

      result.push({
        key,
        campaignId: first.campaignId,
        title: first.title,
        year: first.year,
        dueDate: first.dueDate,
        amount: first.amount,
        note: first.note,
        items: feeItems,
        totalMembers,
        paidMembers,
        unpaidMembers,
        partialMembers,
        overdueMembers,
        totalExpected,
        totalPaid,
        totalRemaining,
        percentagePaid,
        percentageMembers,
        status,
      });
    });

    return result.sort((a, b) => b.year - a.year || a.title.localeCompare(b.title));
  }, [items]);

  // Overall totals across all campaigns for selected year
  const totals = useMemo(() => {
    return items.reduce(
      (sum, item) => ({
        amount: sum.amount + item.amount,
        paid: sum.paid + item.paid,
        remaining: sum.remaining + item.remaining,
      }),
      { amount: 0, paid: 0, remaining: 0 },
    );
  }, [items]);

  const totalMembersCount = items.length;
  const totalPaidMembersCount = items.filter(
    (m) => m.status === "paid" || m.remaining === 0,
  ).length;

  // Currently active campaign object
  const campaignDialogRef = useRef<HTMLElement>(null);
  const campaignChildOpen = creating || !!active || deleteTargets.length > 0;

  const selectedCampaign = useMemo(() => {
    if (!selectedCampaignKey) return null;
    return campaigns.find((c) => c.key === selectedCampaignKey) || null;
  }, [campaigns, selectedCampaignKey]);

  useEffect(() => {
    if (!selectedCampaign || campaignChildOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    campaignDialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setSelectedCampaignKey(null);
      }
      if (event.key === "Tab") {
        const elements = Array.from(campaignDialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], [tabindex="0"]'
        ) || []);
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === campaignDialogRef.current)) {
          event.preventDefault(); last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [!!selectedCampaign, campaignChildOpen]);


  // Filter campaigns on main list
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((c) => {
      const matchQuery =
        !query ||
        c.title.toLocaleLowerCase("vi").includes(query.toLocaleLowerCase("vi")) ||
        c.note.toLocaleLowerCase("vi").includes(query.toLocaleLowerCase("vi"));
      const matchStatus =
        campaignStatusFilter === "all" || c.status === campaignStatusFilter;
      return matchQuery && matchStatus;
    });
  }, [campaigns, query, campaignStatusFilter]);

  // Filter members inside selected campaign
  const filteredCampaignMembers = useMemo(() => {
    if (!selectedCampaign) return [];
    return selectedCampaign.items.filter((m) => {
      const isPaid = m.status === "paid" || m.remaining === 0;
      const matchTab =
        memberFilterTab === "all" ||
        (memberFilterTab === "paid" && isPaid) ||
        (memberFilterTab === "unpaid" && !isPaid);

      const matchQuery =
        !memberSearchQuery ||
        [m.memberName, m.memberEmail]
          .join(" ")
          .toLocaleLowerCase("vi")
          .includes(memberSearchQuery.toLocaleLowerCase("vi"));

      return matchTab && matchQuery;
    });
  }, [selectedCampaign, memberFilterTab, memberSearchQuery]);

  // Members selection options for Create modal
  const memberOptions = useMemo(() => {
    return members.filter((member) =>
      !existingMemberIds.includes(member.id) && (member.name + " " + member.email)
        .toLocaleLowerCase("vi")
        .includes(memberModalQuery.toLocaleLowerCase("vi")),
    );
  }, [members, memberModalQuery, existingMemberIds]);

  const openCreate = () => {
    setCampaignId(crypto.randomUUID());
    setAddingMembers(false);
    setExistingMemberIds([]);
    setTitle("Phí thường niên");
    setAmount("");
    setDueDate(year + "-12-31");
    setNote("");
    setSelected([]);
    setMemberModalQuery("");
    setFormError("");
    setCreating(true);
  };

  const openAddMembersToCampaign = (campaign: FeeCampaign) => {
    setCampaignId(campaign.campaignId);
    setAddingMembers(true);
    setExistingMemberIds(campaign.items.map(item => item.memberId));
    setTitle(campaign.title);
    setAmount(String(campaign.amount));
    setDueDate(campaign.dueDate);
    setNote(campaign.note);
    // Exclude members who already have this fee

    setSelected([]);
    setMemberModalQuery("");
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

  // URL deep-link handling (?fee=id)
  useEffect(() => {
    let alive = true;
    const openFromUrl = async () => {
      const id = new URL(window.location.href).searchParams.get("fee");
      if (!id) return;
      try {
        const fee = await memberFeeService.get(id);
        if (alive) {
          setYear(fee.year);
          const campaignKey = fee.campaignId || `${fee.year}_${normalizeTitle(fee.title)}`;
          if (canManage) setSelectedCampaignKey(campaignKey);
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

  const notifyAllCampaignUnpaid = async (campaign: FeeCampaign) => {
    if (sendingAll) return;
    const targets = campaign.items.filter((f) => f.remaining > 0);
    if (!targets.length) {
      toast.success("Tất cả thành viên trong khoản phí này đã đóng đủ.");
      return;
    }
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
      setSendProgress(`Đang gửi ${sent + failed}/${targets.length}`);
    }
    setSendingAll(false);
    setReload((v) => v + 1);
    setSendProgress(
      `Đã gửi ${sent} thành viên` +
      (failed ? `; ${failed} lỗi: ${failure}` : ". Khoản đã gửi hôm nay sẽ không bị gửi trùng."),
    );
  };

  const notifySingleMember = async (feeId: string) => {
    setSendingMemberId(feeId);
    try {
      await memberFeeService.notify(feeId);
      toast.success("Đã gửi thông báo và email kèm mã QR cho thành viên.");
      setReload((v) => v + 1);
    } catch (e: any) {
      toast.error(e.message || "Gửi thông báo thất bại.");
    } finally {
      setSendingMemberId(null);
    }
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
        ...(campaignId ? { campaignId } : {}),
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

  const requestDelete = (targets: MemberFee[]) => {
    setDeleteError("");
    setDeleteTargets(targets.filter(item => item.payments.length === 0));
  };
  const confirmDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    const failed: MemberFee[] = [];
    const removed = new Set<string>();
    let failure = "";
    for (const item of deleteTargets) {
      try { await memberFeeService.delete(item._id); removed.add(item._id); }
      catch (error: any) { failed.push(item); failure = error.message; }
    }
    setItems(previous => previous.filter(item => !removed.has(item._id)));
    if (active && removed.has(active._id)) closeDetail();
    setDeleteTargets(failed);
    setDeleteError(failure);
    setDeleting(false);
    if (removed.size) toast.success("Đã xóa " + removed.size + " khoản chưa có lịch sử thu tiền.");
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

  // Export CSV for the campaigns summary list
  const exportCampaignsCsv = () => {
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
        "Khoản phí",
        "Năm",
        "Mức phí/người (VND)",
        "Hạn đóng",
        "Tổng phải thu (VND)",
        "Đã thu (VND)",
        "Còn thiếu (VND)",
        "Số người đã đóng",
        "Số người phải đóng",
        "Tiến độ thu tiền (%)",
        "Tiến độ người đóng (%)",
        "Trạng thái",
      ],
      ...filteredCampaigns.map((c) => [
        c.title,
        c.year,
        c.amount,
        c.dueDate,
        c.totalExpected,
        c.totalPaid,
        c.totalRemaining,
        c.paidMembers,
        c.totalMembers,
        c.percentagePaid,
        c.percentageMembers,
        c.status === "completed"
          ? "Đã hoàn thành"
          : c.status === "overdue"
            ? "Quá hạn"
            : "Đang thu",
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
    anchor.download = `danh-sach-phi-thuong-nien-${year}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  // Export CSV for a specific campaign's members list
  const exportCampaignMembersCsv = (campaign: FeeCampaign) => {
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
        "Khoản phí",
        "Năm",
        "Thành viên",
        "Email",
        "Hạn đóng",
        "Phải đóng (VND)",
        "Đã đóng (VND)",
        "Còn thiếu (VND)",
        "Trạng thái",
      ],
      ...campaign.items.map((m) => [
        m.title,
        m.year,
        m.memberName,
        m.memberEmail,
        m.dueDate,
        m.amount,
        m.paid,
        m.remaining,
        memberStatusLabels[m.status],
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
    anchor.download = `chi-tiet-${normalizeTitle(campaign.title)}-${campaign.year}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const statCards = [
    {
      label: "Tổng phải đóng",
      value: money(totals.amount),
      sub: `${campaigns.length} đợt thu phí`,
      Icon: TrendingUp,
      iconBg: "bg-indigo-50",
      iconColor: "text-indigo-600",
      border: "border-l-indigo-500",
    },
    {
      label: "Đã thu được",
      value: money(totals.paid),
      sub:
        totals.amount > 0
          ? `${Math.round((totals.paid / totals.amount) * 100)}% tổng số tiền`
          : "0%",
      Icon: CheckCircle2,
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-600",
      border: "border-l-emerald-500",
    },
    {
      label: "Còn phải đóng",
      value: money(totals.remaining),
      sub: "Cần tiếp tục thu",
      Icon: AlertCircle,
      iconBg: "bg-rose-50",
      iconColor: "text-rose-500",
      border: "border-l-rose-500",
    },
    {
      label: "Số người đã đóng",
      value: `${totalPaidMembersCount} / ${totalMembersCount}`,
      sub:
        totalMembersCount > 0
          ? `${Math.round((totalPaidMembersCount / totalMembersCount) * 100)}% thành viên hoàn thành`
          : "Chưa có thành viên",
      Icon: Users,
      iconBg: "bg-cyan-50",
      iconColor: "text-cyan-600",
      border: "border-l-cyan-500",
    },
  ];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50">
      {!canManage ? (
        <PersonalMemberFees items={items} year={year} loading={loading} error={error}
          onYearChange={setYear} onRetry={() => setReload((value) => value + 1)} onDetail={openDetail} />
      ) : (
      <div inert={!!selectedCampaign} aria-hidden={selectedCampaign ? true : undefined}>
      {/* Top Header */}
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur-sm px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-600 shadow-md shadow-cyan-200">
              <Wallet className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Phí thường niên
                </h2>

              </div>

            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={loading || !campaigns.length}
              onClick={exportCampaignsCsv}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 cursor-pointer shadow-xs"
            >
              <Download className="h-3.5 w-3.5" />
              Xuất CSV danh sách
            </button>
            {canManage && (
              <button
                type="button"
                onClick={openCreate}
                disabled={loading || !!error}
                className="flex items-center gap-1.5 rounded-xl bg-cyan-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-cyan-700 disabled:opacity-40 transition cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Tạo khoản phí
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-5 p-4 sm:p-6">
        {settingsOpen && (
          <FeeSePaySettings onClose={() => setSettingsOpen(false)} />
        )}

        {/* Global Error Banner */}
        {error && (
          <div
            role="alert"
            className="flex items-center gap-3 rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setReload((v) => v + 1)}
              className="ml-auto rounded-lg border border-rose-200 bg-white px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 cursor-pointer"
            >
              Thử lại
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 1: CAMPAIGN DETAIL VIEW (CHI TIẾT PHÍ THƯỜNG NIÊN)                   */}
        {/* ========================================================================= */}
          <div className="space-y-5">
            {/* Stat Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {statCards.map((card) => (
                <div
                  key={card.label}
                  className={`rounded-2xl border border-slate-200 border-l-4 bg-white p-5 shadow-xs ${card.border}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        {card.label} · {year}
                      </p>
                      <p className="mt-2 text-2xl font-bold font-mono text-slate-900">
                        {loading ? (
                          <span className="inline-block h-7 w-28 animate-pulse rounded-lg bg-slate-100" />
                        ) : (
                          card.value
                        )}
                      </p>
                    </div>
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-xl ${card.iconBg}`}
                    >
                      <card.Icon className={`h-4 w-4 ${card.iconColor}`} />
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{card.sub}</p>
                </div>
              ))}
            </div>

            {/* Filters Bar */}
            <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Năm
                <select
                  aria-label="Năm thu phí"
                  value={year}
                  onChange={(e) => setYear(+e.target.value)}
                  className={inputClass}
                  style={{ minWidth: 100 }}
                >
                  {Array.from({ length: 21 }, (_, i) => 2020 + i).map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </label>

              <label className="min-w-[240px] flex-1 text-xs font-bold uppercase tracking-wider text-slate-500">
                Tìm tên khoản phí
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3.5 py-2.5 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 transition"
                    placeholder="Tên khoản phí, ghi chú..."
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </label>

              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Trạng thái đợt phí
                <select
                  value={campaignStatusFilter}
                  onChange={(e) =>
                    setCampaignStatusFilter(
                      e.target.value as typeof campaignStatusFilter,
                    )
                  }
                  className={inputClass}
                  style={{ minWidth: 160 }}
                >
                  <option value="all">Tất cả trạng thái</option>
                  <option value="in_progress">Đang thu</option>
                  <option value="completed">Đã hoàn thành 100%</option>
                  <option value="overdue">Quá hạn</option>
                </select>
              </label>
            </div>

            {/* Campaign Cards (Danh sách đợt phí) */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <RefreshCw className="h-8 w-8 animate-spin text-cyan-600 mb-3" />
                <p className="text-sm font-semibold text-slate-500">
                  Đang tải danh sách khoản phí...
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredCampaigns.map((campaign) => (
                  <article
                    key={campaign.key}
                    aria-label={campaign.title}
                    className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-xs transition hover:border-cyan-200 hover:shadow-md"
                  >
                    {/* Header: Title + Status */}
                    <div className="flex items-start justify-between gap-2">
                      <span className="break-words font-bold text-slate-900 text-sm sm:text-base">
                        {campaign.title}
                      </span>
                      <span
                        className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${campaign.status === "completed"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : campaign.status === "overdue"
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "bg-sky-50 text-sky-700 border border-sky-200"
                          }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${campaign.status === "completed"
                              ? "bg-emerald-500"
                              : campaign.status === "overdue"
                                ? "bg-rose-500"
                                : "bg-sky-500"
                            }`}
                        />
                        {campaign.status === "completed"
                          ? "Hoàn thành"
                          : campaign.status === "overdue"
                            ? "Quá hạn"
                            : `Đang thu (${campaign.paidMembers}/${campaign.totalMembers})`}
                      </span>
                    </div>

                    {/* Subhead: Rate & Due Date */}
                    <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span>
                        Định mức:{" "}
                        <strong className="text-slate-700 font-mono">
                          {money(campaign.amount)}
                        </strong>
                        /người
                      </span>
                      <div className="flex items-center gap-1 font-mono text-slate-600">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        <span>Hạn: {dateText(campaign.dueDate)}</span>
                        {campaign.dueDate < today() && campaign.totalRemaining > 0 && (
                          <span className="ml-1 text-[10px] font-bold text-rose-600">
                            (Quá hạn)
                          </span>
                        )}
                      </div>
                    </div>
                    {campaign.note && (
                      <p className="mt-1 truncate text-xs text-slate-400 italic">
                        · {campaign.note}
                      </p>
                    )}

                    {/* Unified Metrics Box: Money & People */}
                    <div className="mt-3 rounded-xl bg-slate-50 p-3 space-y-2.5">
                      {/* Money: Đã đóng / Phải đóng */}
                      <div>
                        <p className="mb-1 text-xs font-semibold text-slate-500">Số tiền (Đã đóng / Phải đóng)</p>
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-baseline justify-between gap-1 text-xs">
                            <span className="font-mono font-bold text-emerald-700">
                              {money(campaign.totalPaid)}
                            </span>
                            <span className="font-mono text-[11px] text-slate-400">
                              / {money(campaign.totalExpected)}
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/80">
                            <div
                              className={`h-full transition-all duration-300 ${campaign.percentagePaid === 100
                                  ? "bg-emerald-500"
                                  : campaign.status === "overdue"
                                    ? "bg-rose-500"
                                    : "bg-cyan-500"
                                }`}
                              style={{ width: `${campaign.percentagePaid}%` }}
                            />
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-1 text-[11px]">
                            <span className="text-slate-500 font-medium">
                              Đạt {campaign.percentagePaid}%
                            </span>
                            {campaign.totalRemaining > 0 ? (
                              <span className="font-mono text-rose-600 font-medium">
                                Còn thiếu: {money(campaign.totalRemaining)}
                              </span>
                            ) : (
                              <span className="text-emerald-600 font-semibold">
                                Đủ 100%
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* People: Đã đóng / Phải đóng */}
                      <div className="border-t border-slate-200/70 pt-2">
                        <p className="mb-1 text-xs font-semibold text-slate-500">Số người (Đã đóng / Phải đóng)</p>
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-cyan-800">
                              {campaign.paidMembers}
                            </span>
                            <span className="font-mono text-slate-400">
                              / {campaign.totalMembers} người
                            </span>
                            <span className="ml-1 rounded-md bg-cyan-100/70 px-1.5 py-0.5 text-[10px] font-bold text-cyan-800 border border-cyan-200/60">
                              {campaign.percentageMembers}%
                            </span>
                          </div>
                          <div className="text-[11px]">
                            {campaign.unpaidMembers > 0 ? (
                              <span className="text-amber-700 font-medium">
                                Còn {campaign.unpaidMembers} người
                              </span>
                            ) : (
                              <span className="text-emerald-700 font-medium">
                                Đã hoàn thành
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-3 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                      {canManage && campaign.items.some(item => item.payments.length === 0) && (
                        <button
                          type="button"
                          onClick={() => requestDelete(campaign.items)}
                          className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50/70 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 hover:border-rose-300 transition cursor-pointer"
                          title="Xóa các khoản chưa có giao dịch thu tiền"
                          aria-label="Xóa khoản chưa thu"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Xóa khoản chưa thu</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCampaignKey(campaign.key);
                          setMemberFilterTab("all");
                          setMemberSearchQuery("");
                        }}
                        className="inline-flex items-center gap-1 rounded-xl bg-cyan-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-cyan-700 transition cursor-pointer group"
                      >
                        <span>Xem chi tiết</span>
                        <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                      </button>
                    </div>
                  </article>
                ))}

                {!filteredCampaigns.length && (
                  <div className="col-span-full rounded-2xl border border-slate-200 bg-white px-5 py-14 text-center text-sm text-slate-400">
                      {campaigns.length
                        ? "Không có khoản phí nào phù hợp với bộ lọc."
                        : "Chưa có khoản phí nào trong năm này. Nhấn 'Tạo khoản phí' để bắt đầu."}
                    </div>
                )}
              </div>
            )}
          </div>
      </div>
      </div>
      )}
        {canManage && selectedCampaign && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-sm sm:p-6"
            onClick={(event) => { if (event.target === event.currentTarget) setSelectedCampaignKey(null); }}
            aria-hidden={campaignChildOpen || undefined}
            inert={campaignChildOpen}
          >
          <section ref={campaignDialogRef} role="dialog" aria-modal="true" aria-labelledby="campaign-detail-title"
            tabIndex={-1}
            className="max-h-[92dvh] w-full max-w-7xl space-y-5 overflow-y-auto rounded-2xl bg-slate-50 p-4 shadow-2xl sm:p-6">

            {/* Top Navigation Bar: Back button & Campaign info */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedCampaignKey(null)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition cursor-pointer shadow-xs"
                    aria-label="Đóng chi tiết khoản phí"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 id="campaign-detail-title" className="text-lg font-bold text-slate-900">
                        {selectedCampaign.title}
                      </h3>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${selectedCampaign.status === "completed"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : selectedCampaign.status === "overdue"
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "bg-sky-50 text-sky-700 border border-sky-200"
                          }`}
                      >
                        {selectedCampaign.status === "completed"
                          ? "Đã hoàn thành 100%"
                          : selectedCampaign.status === "overdue"
                            ? "Quá hạn nộp"
                            : "Đang thu"}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Banknote className="h-3.5 w-3.5 text-slate-400" />
                        Định mức:{" "}
                        <strong className="text-slate-700 font-mono">
                          {money(selectedCampaign.amount)} / người
                        </strong>
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        Hạn đóng:{" "}
                        <strong className="text-slate-700 font-mono">
                          {dateText(selectedCampaign.dueDate)}
                        </strong>
                      </span>
                      {selectedCampaign.note && (
                        <span className="text-slate-500 italic">
                          ({selectedCampaign.note})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => exportCampaignMembersCsv(selectedCampaign)} disabled={loading || !selectedCampaign.items.length}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40">
                    <Download className="h-3.5 w-3.5" />
                    Xuất CSV thành viên
                  </button>
                  {canManage && (
                    <button
                      type="button"
                      disabled={
                        sendingAll || selectedCampaign.unpaidMembers === 0
                      }
                      onClick={() => void notifyAllCampaignUnpaid(selectedCampaign)}
                      className="flex items-center gap-1.5 rounded-xl border border-cyan-200 bg-cyan-50 px-3.5 py-2 text-xs font-bold text-cyan-800 transition hover:bg-cyan-100 disabled:opacity-40 cursor-pointer shadow-xs"
                    >
                      {sendingAll ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          <span>Đang gửi...</span>
                        </>
                      ) : (
                        <>
                          <Send className="h-3.5 w-3.5 text-cyan-600" />
                          <span>
                            Gửi QR nhắc {selectedCampaign.unpaidMembers} người chưa đóng
                          </span>
                        </>
                      )}
                    </button>
                  )}
                  {canManage && selectedCampaign.items.some(item => item.payments.length === 0) && (
                    <button type="button" onClick={() => requestDelete(selectedCampaign.items)} className="rounded-xl border border-rose-200 px-3.5 py-2 text-xs font-semibold text-rose-700">Xóa khoản chưa thu của đợt</button>
                  )}
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => openAddMembersToCampaign(selectedCampaign)}
                      className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 cursor-pointer shadow-xs"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Thêm thành viên
                    </button>
                  )}
                </div>
              </div>

              {sendProgress && (
                <div className="mt-3 rounded-xl bg-cyan-50/80 border border-cyan-100 p-2.5 text-xs text-cyan-800">
                  {sendProgress}
                </div>
              )}
            </div>

            {/* Campaign Summary KPI Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 border-l-4 border-l-emerald-500 bg-white p-4 shadow-xs">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Số tiền đã đóng / Phải đóng
                </p>
                <div className="mt-2 flex items-baseline justify-between gap-2">
                  <p className="text-xl font-bold font-mono text-emerald-700">
                    {money(selectedCampaign.totalPaid)}
                  </p>
                  <p className="text-xs font-mono text-slate-400">
                    / {money(selectedCampaign.totalExpected)}
                  </p>
                </div>
                <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${selectedCampaign.percentagePaid}%` }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Đã thu đạt {selectedCampaign.percentagePaid}% kế hoạch
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 border-l-4 border-l-rose-500 bg-white p-4 shadow-xs">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Số tiền còn thiếu
                </p>
                <p className="mt-2 text-xl font-bold font-mono text-rose-600">
                  {money(selectedCampaign.totalRemaining)}
                </p>
                <p className="mt-3.5 text-[11px] text-slate-500">
                  {selectedCampaign.totalRemaining === 0
                    ? "Đã thu đủ toàn bộ số tiền"
                    : `Cần thu tiếp từ ${selectedCampaign.unpaidMembers} người`}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 border-l-4 border-l-cyan-500 bg-white p-4 shadow-xs">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Số người đã đóng / Phải đóng
                </p>
                <div className="mt-2 flex items-baseline justify-between gap-2">
                  <p className="text-xl font-bold font-mono text-cyan-700">
                    {selectedCampaign.paidMembers} người
                  </p>
                  <p className="text-xs font-mono text-slate-400">
                    / {selectedCampaign.totalMembers} người
                  </p>
                </div>
                <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full bg-cyan-600 transition-all duration-300"
                    style={{ width: `${selectedCampaign.percentageMembers}%` }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  {selectedCampaign.percentageMembers}% thành viên đã hoàn thành
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 border-l-4 border-l-amber-500 bg-white p-4 shadow-xs">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Số người chưa đóng đủ
                </p>
                <p className="mt-2 text-xl font-bold font-mono text-amber-600">
                  {selectedCampaign.unpaidMembers} người
                </p>
                <p className="mt-3.5 text-[11px] text-slate-500">
                  {selectedCampaign.partialMembers > 0
                    ? `${selectedCampaign.partialMembers} người nộp 1 phần`
                    : "Chưa thanh toán"}
                  {selectedCampaign.overdueMembers > 0
                    ? ` · ${selectedCampaign.overdueMembers} quá hạn`
                    : ""}
                </p>
              </div>
            </div>

            {/* Member Filter Tabs & Search Bar */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Tabs: Tất cả / Đã đóng / Chưa đóng */}
                <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => setMemberFilterTab("all")}
                    className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${memberFilterTab === "all"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                      }`}
                  >
                    <Users className="h-3.5 w-3.5" />
                    <span>Tất cả</span>
                    <span className="ml-1 rounded-full bg-slate-200 px-1.5 py-0.2 text-[10px] font-mono text-slate-700">
                      {selectedCampaign.totalMembers}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMemberFilterTab("paid")}
                    className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${memberFilterTab === "paid"
                        ? "bg-white text-emerald-700 shadow-xs"
                        : "text-slate-600 hover:text-emerald-700"
                      }`}
                  >
                    <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Đã đóng</span>
                    <span className="ml-1 rounded-full bg-emerald-100 px-1.5 py-0.2 text-[10px] font-mono text-emerald-800">
                      {selectedCampaign.paidMembers}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMemberFilterTab("unpaid")}
                    className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${memberFilterTab === "unpaid"
                        ? "bg-white text-rose-700 shadow-xs"
                        : "text-slate-600 hover:text-rose-700"
                      }`}
                  >
                    <UserX className="h-3.5 w-3.5 text-rose-500" />
                    <span>Chưa đóng</span>
                    <span className="ml-1 rounded-full bg-rose-100 px-1.5 py-0.2 text-[10px] font-mono text-rose-800">
                      {selectedCampaign.unpaidMembers}
                    </span>
                  </button>
                </div>

                {/* Member Search input */}
                <div className="relative min-w-[240px] flex-1 sm:max-w-xs">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    value={memberSearchQuery}
                    onChange={(e) => setMemberSearchQuery(e.target.value)}
                    placeholder="Tìm họ tên, email thành viên..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-3.5 py-2 text-xs outline-none focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-100 transition"
                  />
                  {memberSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setMemberSearchQuery("")}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Campaign Members Table */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[940px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80">
                      <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 min-w-[240px]">
                        Thành viên
                      </th>
                      <th className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap w-[130px]">
                        Phải đóng
                      </th>
                      <th className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap w-[130px]">
                        Đã đóng
                      </th>
                      <th className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap w-[130px]">
                        Còn thiếu
                      </th>
                      <th className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap w-[130px]">
                        Trạng thái
                      </th>
                      <th className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap w-[130px]">
                        Lịch sử nộp
                      </th>
                      <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 text-right whitespace-nowrap w-[180px]">
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCampaignMembers.map((item) => {
                      const sc = memberStatusConfig[item.status];
                      const activePayments = item.payments.filter((p) => !p.voidedAt);
                      const latestPayment =
                        activePayments.length > 0
                          ? activePayments[activePayments.length - 1]
                          : null;

                      return (
                        <tr
                          key={item._id}
                          className="transition-colors hover:bg-slate-50/70"
                        >
                          {/* Member Info */}
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-50 font-bold text-xs text-cyan-800 uppercase">
                                {(item.memberName || "?").slice(0, 2)}
                              </div>
                              <div>
                                <p className="font-semibold text-slate-900">
                                  {item.memberName}
                                </p>
                                <p className="text-[11px] font-mono text-slate-400">
                                  {item.memberEmail}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Phải đóng */}
                          <td className="whitespace-nowrap px-4 py-3.5 font-mono text-slate-700">
                            {money(item.amount)}
                          </td>

                          {/* Đã đóng */}
                          <td className="whitespace-nowrap px-4 py-3.5 font-mono font-semibold text-emerald-700">
                            {money(item.paid)}
                          </td>

                          {/* Còn thiếu */}
                          <td className="whitespace-nowrap px-4 py-3.5 font-mono font-bold">
                            {item.remaining > 0 ? (
                              <span className="text-rose-600">
                                {money(item.remaining)}
                              </span>
                            ) : (
                              <span className="text-slate-400">0 ₫</span>
                            )}
                          </td>

                          {/* Trạng thái */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${sc.bg} ${sc.text} border ${sc.border}`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${sc.dot}`}
                              />
                              {memberStatusLabels[item.status]}
                            </span>
                          </td>

                          {/* Lịch sử nộp */}
                          <td className="px-4 py-3.5 whitespace-nowrap text-xs text-slate-500">
                            {latestPayment ? (
                              <div>
                                <span className="font-mono text-slate-700">
                                  {dateText(latestPayment.paidOn)}
                                </span>
                                <span className="ml-1 text-[11px] text-slate-400">
                                  ({activePayments.length} lần nộp)
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">
                                Chưa nộp
                              </span>
                            )}
                          </td>

                          {/* Action Buttons */}
                          <td className="px-5 py-3.5 whitespace-nowrap text-right">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              {canManage && item.payments.length === 0 && (
                                <button
                                  type="button"
                                  onClick={() => requestDelete([item])}
                                  className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50/60 px-2 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                                  title="Xóa khoản chưa có lịch sử thu tiền của thành viên này"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  <span>Xóa</span>
                                </button>
                              )}
                              {canManage && item.remaining > 0 && (
                                <button
                                  type="button"
                                  disabled={sendingMemberId === item._id}
                                  onClick={() => void notifySingleMember(item._id)}
                                  className="flex items-center gap-1 rounded-lg border border-cyan-200 bg-cyan-50 px-2.5 py-1.5 text-xs font-semibold text-cyan-800 transition hover:bg-cyan-100 disabled:opacity-40 cursor-pointer"
                                  title="Gửi email và thông báo kèm mã QR cho thành viên này"
                                >
                                  {sendingMemberId === item._id ? (
                                    <RefreshCw className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Send className="h-3 w-3" />
                                  )}
                                  <span>Gửi QR</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => openDetail(item)}
                                className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                                  item.remaining > 0
                                    ? "bg-cyan-600 text-white hover:bg-cyan-700 shadow-xs"
                                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                }`}
                              >
                                {item.remaining > 0 ? "Thanh toán" : "Chi tiết"}
                                <ChevronRight className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {!filteredCampaignMembers.length && (
                      <tr>
                        <td
                          colSpan={7}
                          className="py-14 text-center text-sm text-slate-400"
                        >
                          {memberFilterTab === "paid"
                            ? "Chưa có thành viên nào hoàn thành khoản phí này."
                            : memberFilterTab === "unpaid"
                              ? "Tuyệt vời! Tất cả thành viên đã đóng đủ khoản phí này."
                              : "Không tìm thấy thành viên phù hợp với từ khóa tìm kiếm."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
          </div>
        )}


      {/* ========================================================================= */}
      {/* MODAL: TẠO KHOẢN PHÍ MỚI                                                  */}
      {/* ========================================================================= */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-fee-title"
            className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between bg-cyan-600 px-6 py-5 rounded-t-3xl">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-cyan-700">
                  <Plus className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h3 id="create-fee-title" className="font-bold text-white">
                    Tạo khoản phí năm {year}
                  </h3>
                  <p className="text-xs text-cyan-100">
                    {addingMembers ? "Thêm thành viên vào đợt thu hiện tại" : "Mỗi lần tạo là một đợt thu riêng, kể cả khi trùng tên và năm."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Đóng"
                disabled={busy}
                onClick={() => setCreating(false)}
                className="rounded-xl p-2 text-cyan-100 hover:bg-cyan-700 hover:text-white transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={create} className="p-6 space-y-5">
              <fieldset disabled={busy} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Tên khoản phí <span className="text-rose-500">*</span>
                  </label>
                  <input
                    required
                    minLength={2}
                    maxLength={150}
                    aria-label="Tên khoản phí"
                    disabled={addingMembers}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className={inputClass}
                    placeholder="Ví dụ: Phí thường niên 2026"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Số tiền mỗi thành viên (VND){" "}
                      <span className="text-rose-500">*</span>
                    </label>
                    <input
                      required
                      aria-label="Số tiền mỗi thành viên (VND)"
                      type="number"
                      min={1}
                      max={1000000000000}
                      step={1}
                      disabled={addingMembers}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className={inputClass}
                      placeholder="1000000"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Hạn đóng <span className="text-rose-500">*</span>
                    </label>
                    <input
                      required
                      type="date"
                      disabled={addingMembers}
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Ghi chú
                  </label>
                  <textarea
                    maxLength={1000}
                    disabled={addingMembers}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className={inputClass}
                    rows={2}
                    placeholder="Thông tin thêm về khoản thu phí này..."
                  />
                </div>
                <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Thành viên áp dụng
                    </span>
                    <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-xs font-bold text-cyan-800">
                      {selected.length} đã chọn
                    </span>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      aria-label="Tìm thành viên áp dụng"
                      placeholder="Tìm tên hoặc email"
                      value={memberModalQuery}
                      onChange={(e) => setMemberModalQuery(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3.5 py-2.5 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 transition"
                    />
                  </div>
                  <div className="flex gap-3 text-[11px]">
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
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelected([])}
                      className="font-semibold text-slate-500 hover:underline cursor-pointer"
                    >
                      Bỏ chọn tất cả
                    </button>
                  </div>
                  <div className="max-h-52 space-y-1 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50 p-2">
                    {memberOptions.map((member) => (
                      <label
                        key={member.id}
                        className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-white transition cursor-pointer"
                      >
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
                        />
                        <div>
                          <span className="font-semibold text-slate-800">
                            {member.name}
                          </span>
                          <span className="ml-2 text-xs font-mono text-slate-400">
                            {member.email}
                          </span>
                        </div>
                      </label>
                    ))}
                    {!memberOptions.length && (
                      <p className="p-4 text-center text-sm text-slate-400">
                        Không có thành viên phù hợp.
                      </p>
                    )}
                  </div>
                </div>
                <p className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-xs text-slate-500">
                  Có thể tạo nhiều đợt thu cùng tên trong cùng năm. Trong mỗi đợt,
                  thành viên đã được thêm sẽ được bỏ qua khi gửi lại yêu cầu.
                </p>
              </fieldset>
              {formError && (
                <p
                  role="alert"
                  className="rounded-xl bg-rose-50 border border-rose-100 p-3 text-sm text-rose-700"
                >
                  {formError}
                </p>
              )}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={busy || !selected.length || selected.length > 1000}
                  className="flex-1 rounded-xl bg-cyan-600 py-2.5 text-sm font-bold text-white hover:bg-cyan-700 disabled:opacity-50 transition cursor-pointer shadow-sm"
                >
                  {busy ? (
                    <span className="flex items-center justify-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Đang tạo...
                    </span>
                  ) : (
                    `Tạo cho ${selected.length} thành viên`
                  )}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CHI TIẾT THANH TOÁN / GHI NHẬN PHIẾU THU THÀNH VIÊN                */}
      {/* ========================================================================= */}
      {active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="fee-detail-title"
            className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl"
          >
            <div className="bg-cyan-600 px-6 py-5 rounded-t-3xl">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-700 text-sm font-bold text-white uppercase shadow-inner">
                    {(active.memberName || "?").slice(0, 2)}
                  </div>
                  <div>
                    <h3 id="fee-detail-title" className="font-bold text-white text-base">
                      {active.memberName}
                    </h3>
                    <p className="text-xs text-cyan-100">
                      {active.title} · Năm {active.year} · Hạn:{" "}
                      {dateText(active.dueDate)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Đóng"
                  disabled={busy}
                  onClick={closeDetail}
                  className="rounded-xl p-2 text-cyan-100 hover:bg-cyan-700 hover:text-white transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {[
                  {
                    label: "Phải đóng",
                    value: active.amount,
                    color: "text-white",
                  },
                  {
                    label: "Đã đóng",
                    value: active.paid,
                    color: "text-emerald-300",
                  },
                  {
                    label: "Còn thiếu",
                    value: active.remaining,
                    color: "text-rose-200",
                  },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="rounded-2xl bg-white/10 border border-white/15 px-4 py-3"
                  >
                    <p className="text-[10px] text-cyan-100 uppercase tracking-wider font-semibold">
                      {s.label}
                    </p>
                    <p
                      className={`mt-1 text-sm font-bold font-mono ${s.color}`}
                    >
                      {money(s.value)}
                    </p>
                  </div>
                ))}
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void refreshDetail()}
                className="mt-3 flex items-center gap-1.5 text-xs text-cyan-100 hover:text-white transition cursor-pointer"
              >
                <RefreshCw
                  className={`h-3 w-3 ${busy ? "animate-spin" : ""}`}
                />
                Cập nhật dữ liệu
              </button>
            </div>
            <div className="p-6 space-y-6">
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
              />
              {active.note && (
                <p className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-sm text-slate-500 whitespace-pre-wrap">
                  {active.note}
                </p>
              )}
              {canManage && active.remaining > 0 && receipt && !voidId && (
                <form
                  onSubmit={receive}
                  className="rounded-2xl border border-cyan-100 bg-cyan-50/40 p-5 space-y-4"
                >
                  <h4 className="flex items-center gap-2 font-bold text-slate-800">
                    <CreditCard className="h-4 w-4 text-cyan-600" />
                    Ghi nhận tiền đã thu
                  </h4>
                  <fieldset
                    disabled={busy}
                    className="grid gap-4 sm:grid-cols-2"
                  >
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                        Số tiền thu (VND){" "}
                        <span className="text-rose-500">*</span>
                      </label>
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
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                        Ngày thu <span className="text-rose-500">*</span>
                      </label>
                      <input
                        required
                        type="date"
                        max={today()}
                        value={receipt.paidOn}
                        onChange={(e) =>
                          setReceipt({ ...receipt, paidOn: e.target.value })
                        }
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                        Hình thức
                      </label>
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
                        <option value="transfer">Chuyển khoản</option>
                        <option value="cash">Tiền mặt</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                        Mã giao dịch / số phiếu
                      </label>
                      <input
                        maxLength={150}
                        value={receipt.reference}
                        onChange={(e) =>
                          setReceipt({ ...receipt, reference: e.target.value })
                        }
                        className={inputClass}
                        placeholder="VD: FT2409..."
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                        Ghi chú phiếu thu
                      </label>
                      <input
                        maxLength={1000}
                        value={receipt.note}
                        onChange={(e) =>
                          setReceipt({ ...receipt, note: e.target.value })
                        }
                        className={inputClass}
                        placeholder="Ghi chú thêm nếu có..."
                      />
                    </div>
                  </fieldset>
                  <button
                    type="submit"
                    disabled={busy}
                    className="flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-cyan-700 disabled:opacity-50 transition cursor-pointer shadow-sm"
                  >
                    {busy ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Banknote className="h-4 w-4" />
                    )}
                    {busy ? "Đang lưu..." : "Lưu phiếu thu"}
                  </button>
                </form>
              )}
              {voidId && (
                <form
                  onSubmit={voidPayment}
                  className="rounded-2xl border border-rose-200 bg-rose-50 p-5 space-y-3"
                >
                  <h4 className="font-bold text-rose-800">
                    Hủy phiếu thu
                  </h4>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-rose-600 mb-1">
                      Lý do hủy <span className="text-rose-500">*</span>
                    </label>
                    <input
                      required
                      minLength={3}
                      maxLength={500}
                      disabled={busy}
                      value={voidReason}
                      onChange={(e) => setVoidReason(e.target.value)}
                      className={inputClass}
                      placeholder="Nhập lý do hủy phiếu thu..."
                    />
                  </div>
                  <p className="text-xs text-rose-600">
                    Số tiền sẽ được cộng lại vào khoản còn phải đóng. Lịch sử
                    vẫn được giữ lại.
                  </p>
                  <div className="flex gap-3">
                    <button
                      type="submit"
                      disabled={busy}
                      className="rounded-xl bg-rose-700 px-4 py-2 text-sm font-bold text-white hover:bg-rose-800 transition cursor-pointer"
                    >
                      Xác nhận hủy
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setVoidId("")}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                    >
                      Bỏ qua
                    </button>
                  </div>
                </form>
              )}
              {formError && (
                <p
                  role="alert"
                  className="rounded-xl bg-rose-50 border border-rose-100 p-3 text-sm text-rose-700"
                >
                  {formError}
                </p>
              )}
              <div>
                <h4 className="mb-3 flex items-center gap-2 font-bold text-slate-800">
                  <Clock className="h-4 w-4 text-slate-400" />
                  Lịch sử thu ({active.payments.length})
                </h4>
                <div className="space-y-3">
                  {[...active.payments].reverse().map((payment) => (
                    <article
                      key={payment.id}
                      className={`rounded-2xl border p-4 text-sm ${payment.voidedAt
                          ? "bg-slate-50 border-slate-100 opacity-60"
                          : "bg-white border-slate-100 shadow-xs"
                        }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`font-bold text-base font-mono ${payment.voidedAt
                              ? "line-through text-slate-400"
                              : "text-slate-800"
                            }`}
                        >
                          {money(payment.amount)}
                        </span>
                        <span className="text-xs text-slate-400">
                          {dateText(payment.paidOn)} ·{" "}
                          {payment.method === "cash"
                            ? "Tiền mặt"
                            : "Chuyển khoản"}
                        </span>
                      </div>
                      {payment.reference && (
                        <p className="mt-1 text-xs text-slate-500 font-mono">
                          Mã: {payment.reference}
                        </p>
                      )}
                      {payment.note && (
                        <p className="mt-1 text-xs text-slate-500 whitespace-pre-wrap">
                          {payment.note}
                        </p>
                      )}
                      <p className="mt-2 text-[11px] text-slate-400">
                        Ghi nhận lúc{" "}
                        {new Date(payment.recordedAt).toLocaleString("vi-VN")}
                      </p>
                      {payment.voidedAt ? (
                        <p className="mt-2 text-xs font-semibold text-rose-600">
                          Đã hủy: {payment.voidReason}
                        </p>
                      ) : (
                        canManage &&
                        payment.recordedBy !== "sepay" && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setVoidId(payment.id);
                              setVoidReason("");
                              setFormError("");
                            }}
                            className="mt-2 rounded-lg border border-rose-100 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                          >
                            Hủy phiếu thu này
                          </button>
                        )
                      )}
                    </article>
                  ))}
                  {!active.payments.length && (
                    <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
                      Chưa ghi nhận phiếu thu.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
      <ConfirmDialog isOpen={deleteTargets.length > 0} isSubmitting={deleting}
        title="Xóa khoản phí chưa thu" confirmLabel="Xác nhận xóa"
        description={deleteError || ("Xóa " + deleteTargets.length + " khoản chưa có phiếu thu? Các khoản đã có lịch sử thu tiền được giữ lại. QR cũ của khoản bị xóa sẽ không còn ghi nhận tự động.")}
        onClose={() => { if (!deleting) setDeleteTargets([]); }} onConfirm={confirmDelete} />
    </div>
  );
}
