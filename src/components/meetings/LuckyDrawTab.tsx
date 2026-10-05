import React, {  useState, useRef } from "react";
import {
  Gift,
  Trophy,
  Sparkles,
  RefreshCw,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Volume2,
  VolumeX,
  RotateCcw,
  Download,
  Layers,
  ExternalLink,
  Dices,
  Play,
  Disc,
  X,
} from "lucide-react";
import {
  Meeting,
  LuckyDrawPrize,
  LuckyDrawWinner,
  LuckyDrawConfig,
  meetingService,
} from "../../services/meetingService";
import { toast } from "../../pages/Toast";
import { playTickSound, playWinFanfare, playSuspenseSound } from "../../utils/soundEffects";
import { launchConfetti } from "../../utils/confetti";

interface LuckyDrawTabProps {
  meeting: Meeting;
  canManage: boolean;
  onRefreshMeeting: () => Promise<void>;
  onStartMeeting?: () => Promise<void>;
}

export function LuckyDrawTab({
  meeting,
  canManage,
  onRefreshMeeting,
  onStartMeeting,
}: LuckyDrawTabProps) {
  const [luckyConfig, setLuckyConfig] = useState<LuckyDrawConfig>(
    meeting.luckyDraw || {
      enabled: true,
      allowRepeatWinners: false,
      drawMode: "attendees",
      numberMin: 1,
      numberMax: 100,
      prizes: [],
    }
  );

  const [selectedPrizeId, setSelectedPrizeId] = useState<string>("");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinningDisplay, setSpinningDisplay] = useState<string>("READY");
  const [activeWinnerModal, setActiveWinnerModal] = useState<{
    winner: LuckyDrawWinner;
    prize: LuckyDrawPrize;
    verificationHash: string;
    seed: string;
  } | null>(null);

  // Prize Edit / Add Modal
  const [isPrizeModalOpen, setIsPrizeModalOpen] = useState(false);
  const [editingPrize, setEditingPrize] = useState<LuckyDrawPrize | null>(null);
  const [prizeName, setPrizeName] = useState("");
  const [prizeReward, setPrizeReward] = useState("");
  const [prizeQuantity, setPrizeQuantity] = useState(1);
  const [prizeOrder, setPrizeOrder] = useState(1);
  const [prizeColor, setPrizeColor] = useState("#f59e0b");
  const [savingPrize, setSavingPrize] = useState(false);

  // Settings dropdown/modal
  const [showConfigPanel, setShowConfigPanel] = useState(false);

  // Confirm popup state (replaces window.confirm)
  const [confirmModal, setConfirmModal] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const showConfirm = (message: string, onConfirm: () => void) => {
    setConfirmModal({ message, onConfirm });
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const tickerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Kiểm tra điều kiện: CUỘC HỌP ĐÃ BẮT ĐẦU CHƯA?
  const isMeetingStarted =
    meeting.status === "live" || meeting.status === "paused" || meeting.status === "ended";

  const [previousInputs1, setPreviousInputs1] = useState<unknown[] | null>(null);
  if (previousInputs1 === null || !Object.is(previousInputs1[0], meeting)) {
    setPreviousInputs1([meeting]);
    if (meeting.luckyDraw) {
      setLuckyConfig(meeting.luckyDraw);
      if (!selectedPrizeId && meeting.luckyDraw.prizes?.length) {
        setSelectedPrizeId(meeting.luckyDraw.prizes[0].id);
      }
    }
  
  }

  const selectedPrize = luckyConfig.prizes?.find((p) => p.id === selectedPrizeId);



  // Quick Preset Prizes
  const handleApplyPresets = async () => {
    if (!canManage) return;
    if (luckyConfig.prizes?.length) {
      showConfirm("Áp dụng cấu hình mẫu sẽ thêm các giải thưởng chuẩn vào danh sách. Tiếp tục?", async () => {
        await doApplyPresets();
      });
      return;
    }
    await doApplyPresets();
  };

  const doApplyPresets = async () => {

    const presets: Array<Partial<LuckyDrawPrize>> = [
      { name: "Giải Đặc Biệt", reward: "Phần thưởng trị giá 10.000.000đ", quantity: 1, order: 1, color: "#e11d48" },
      { name: "Giải Nhất", reward: "Phần thưởng trị giá 5.000.000đ", quantity: 1, order: 2, color: "#f59e0b" },
      { name: "Giải Nhì", reward: "Phần thưởng trị giá 2.000.000đ", quantity: 2, order: 3, color: "#8b5cf6" },
      { name: "Giải Ba", reward: "Phần thưởng trị giá 1.000.000đ", quantity: 3, order: 4, color: "#06b6d4" },
      { name: "Giải Khuyến Khích", reward: "Voucher quà tặng 500.000đ", quantity: 5, order: 5, color: "#10b981" },
    ];

    try {
      for (const p of presets) {
        await meetingService.addOrUpdatePrize(meeting._id, p);
      }
      toast.success("Đã thêm bộ giải thưởng mẫu thành công!");
      await onRefreshMeeting();
    } catch (err) {
      toast.error(err.message || "Không thể tạo giải thưởng mẫu.");
    }
  };

  // Open Add Prize Modal
  const openAddPrizeModal = () => {
    setEditingPrize(null);
    setPrizeName("");
    setPrizeReward("");
    setPrizeQuantity(1);
    setPrizeOrder((luckyConfig.prizes?.length || 0) + 1);
    setPrizeColor("#f59e0b");
    setIsPrizeModalOpen(true);
  };

  // Open Edit Prize Modal
  const openEditPrizeModal = (prize: LuckyDrawPrize) => {
    setEditingPrize(prize);
    setPrizeName(prize.name);
    setPrizeReward(prize.reward || "");
    setPrizeQuantity(prize.quantity || 1);
    setPrizeOrder(prize.order || 1);
    setPrizeColor(prize.color || "#f59e0b");
    setIsPrizeModalOpen(true);
  };

  // Save Prize Form
  const handleSavePrize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prizeName.trim()) {
      toast.warning("Vui lòng nhập tên giải thưởng!");
      return;
    }

    setSavingPrize(true);
    try {
      const updated = await meetingService.addOrUpdatePrize(meeting._id, {
        id: editingPrize?.id,
        name: prizeName.trim(),
        reward: prizeReward.trim(),
        quantity: Math.max(1, prizeQuantity),
        order: prizeOrder,
        color: prizeColor,
      });
      setLuckyConfig(updated);
      toast.success(editingPrize ? "Cập nhật giải thưởng thành công!" : "Thêm giải thưởng mới thành công!");
      setIsPrizeModalOpen(false);
      await onRefreshMeeting();
    } catch (err) {
      toast.error(err.message || "Lỗi lưu giải thưởng.");
    } finally {
      setSavingPrize(false);
    }
  };

  // Delete Prize
  const handleDeletePrize = async (prizeId: string) => {
    showConfirm("Bạn có chắc chắn muốn xóa giải thưởng này?", async () => {
      try {
        const updated = await meetingService.deletePrize(meeting._id, prizeId);
        setLuckyConfig(updated);
        if (selectedPrizeId === prizeId) {
          setSelectedPrizeId(updated.prizes?.[0]?.id || "");
        }
        toast.success("Đã xóa giải thưởng.");
        await onRefreshMeeting();
      } catch (err) {
        toast.error(err.message || "Xóa giải thưởng thất bại.");
      }
    });
  };

  // Save Settings
  const handleSaveSettings = async (newConfig: Partial<LuckyDrawConfig>) => {
    try {
      const updated = await meetingService.updateLuckyDrawConfig(meeting._id, newConfig);
      setLuckyConfig(updated);
      toast.success("Đã cập nhật cấu hình quay thưởng.");
      await onRefreshMeeting();
    } catch (err) {
      toast.error(err.message || "Không thể cập nhật cấu hình.");
    }
  };

  // ========================================================
  // RANDOM.ORG STYLE SPIN LOGIC
  // ========================================================
  const handleSpin = async () => {
    if (!isMeetingStarted) {
      toast.warning("Cuộc họp chưa bắt đầu! Chỉ có thể quay thưởng khi cuộc họp đã bắt đầu.");
      return;
    }

    if (!selectedPrize) {
      toast.warning("Vui lòng chọn giải thưởng cần quay!");
      return;
    }

    if (selectedPrize.winners.length >= selectedPrize.quantity) {
      toast.warning(`Giải "${selectedPrize.name}" đã đủ số lượng người trúng (${selectedPrize.quantity}/${selectedPrize.quantity})!`);
      return;
    }

    if (isSpinning) return;

    // Danh sách ứng viên quay số để hiển thị hiệu ứng rolling
    const speakers = meeting.speakers || [];
    const previousWinnerIds = new Set<string>();
    if (!luckyConfig.allowRepeatWinners) {
      for (const p of luckyConfig.prizes || []) {
        for (const w of p.winners || []) {
          previousWinnerIds.add(String(w.winnerId));
        }
      }
    }

    const candidatePool = speakers.filter((s) => !previousWinnerIds.has(String(s.id)));
    if (luckyConfig.drawMode === "attendees" && !candidatePool.length) {
      toast.error("Không còn người tham gia hợp lệ nào chưa trúng giải để quay tiếp!");
      return;
    }

    setIsSpinning(true);
    if (soundEnabled) playSuspenseSound();

    // Call API to generate cryptographic winner
    let spinResultPromise: ReturnType<typeof meetingService.spinLuckyDraw>;
    try {
      spinResultPromise = meetingService.spinLuckyDraw(meeting._id, selectedPrize.id);
    } catch (err) {
      setIsSpinning(false);
      toast.error(err.message || "Không thể kết nối máy chủ quay thưởng.");
      return;
    }

    // High-speed rolling animation (Random.org style)
    let rollIndex = 0;
    
    const duration = 4000; // 4 seconds suspense rolling

    const rollingInterval = setInterval(() => {
      rollIndex++;
      if (luckyConfig.drawMode === "attendees") {
        const dummy = candidatePool[rollIndex % candidatePool.length];
        setSpinningDisplay(dummy ? dummy.name : `Ticket #${rollIndex % 100}`);
      } else {
        const min = luckyConfig.numberMin || 1;
        const max = luckyConfig.numberMax || 100;
        const randomNum = Math.floor(Math.random() * (max - min + 1)) + min;
        setSpinningDisplay(`LUCKY #${randomNum.toString().padStart(3, "0")}`);
      }

      if (soundEnabled && rollIndex % 2 === 0) {
        playTickSound(600 + (rollIndex % 5) * 80);
      }
    }, 70);

    tickerIntervalRef.current = rollingInterval;

    try {
      const result = await spinResultPromise;

      // Decelerate animation curve to the real winner
      setTimeout(() => {
        clearInterval(rollingInterval);

        // Final slowdown ticks
        setTimeout(() => {
          if (soundEnabled) playTickSound(1000);
          setSpinningDisplay(result.winner.name || `#${result.winner.ticketNumber}`);

          setTimeout(() => {
            setIsSpinning(false);
            if (soundEnabled) playWinFanfare();
            launchConfetti(5000);

            setActiveWinnerModal({
              winner: result.winner,
              prize: result.prize,
              verificationHash: result.verificationHash,
              seed: result.seed,
            });

            onRefreshMeeting();
          }, 350);
        }, 300);
      }, duration);
    } catch (err) {
      clearInterval(rollingInterval);
      setIsSpinning(false);
      setSpinningDisplay("READY");
      toast.error(err.message || "Quay thưởng thất bại.");
    }
  };

  // Redraw Winner
  const handleRedraw = async (winner: LuckyDrawWinner) => {
    if (!canManage) return;
    showConfirm(`Hủy kết quả của "${winner.name}" và cho phép quay lại?`, async () => {
      try {
        await meetingService.redrawWinner(meeting._id, winner.prizeId, winner.id);
        toast.success("Đã hủy kết quả. Bạn có thể bấm Quay lại giải này.");
        setActiveWinnerModal(null);
        await onRefreshMeeting();
      } catch (err) {
        toast.error(err.message || "Không thể hủy kết quả.");
      }
    });
  };

  // Reset Winners
  const handleResetWinners = async (prizeId?: string) => {
    if (!canManage) return;
    const confirmMsg = prizeId
      ? "Đặt lại kết quả người trúng giải này?"
      : "Đặt lại toàn bộ kết quả trúng thưởng của tất cả các giải?";
    showConfirm(confirmMsg, async () => {
      try {
        const updated = await meetingService.resetWinners(meeting._id, prizeId);
        setLuckyConfig(updated);
        toast.success("Đã làm mới danh sách người trúng giải.");
        await onRefreshMeeting();
      } catch (err) {
        toast.error(err.message || "Đặt lại thất bại.");
      }
    });
  };

  // Export Results
  const handleExportCSV = () => {
    const allWinners: Array<{ prize: string; name: string; email: string; wonAt: string; hash: string }> = [];
    for (const p of luckyConfig.prizes || []) {
      for (const w of p.winners || []) {
        allWinners.push({
          prize: p.name,
          name: w.name,
          email: w.email || "",
          wonAt: new Date(w.wonAt).toLocaleString("vi-VN"),
          hash: w.verificationHash || "",
        });
      }
    }

    if (!allWinners.length) {
      toast.warning("Chưa có kết quả trúng thưởng nào để xuất!");
      return;
    }

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      ["Giải thưởng,Người trúng,Email,Thời gian trúng,Mã bốc thăm"]
        .concat(
          allWinners.map((r) => `"${r.prize}","${r.name}","${r.email}","${r.wonAt}","${r.hash}"`)
        )
        .join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Ket_Qua_Quay_Thuong_${meeting.title.replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Đã xuất danh sách trúng thưởng!");
  };

  return (
    <div
      ref={containerRef}
      className="space-y-6"
    >
      {/* Top Banner Alert: CHỈ QUAY KHI CUỘC HỌP ĐÃ BẮT ĐẦU */}
      {!isMeetingStarted && (
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 text-amber-600 rounded-xl shrink-0 mt-0.5">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm text-amber-900 font-semibold">
                Quay thưởng đang tạm khóa
              </h4>
              <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                Chức năng quay thưởng chỉ kích hoạt khi cuộc họp đã bắt đầu.{canManage ? " Nhấn nút bên cạnh để bắt đầu." : ""}
              </p>
            </div>
          </div>

          {canManage && onStartMeeting && (
            <button
              type="button"
              onClick={onStartMeeting}
              className="shrink-0 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-medium shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="h-4 w-4" />
              Bắt đầu cuộc họp
            </button>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* BNI LUXURY LUCKY DRAW SHOWCASE (VÒNG QUAY & LỒNG CẦU BINGO) */}
      {/* ======================================================== */}
      <div className="rounded-2xl border border-red-100 bg-white p-5 sm:p-6 shadow-xs overflow-hidden">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#cf142b] text-white shadow-sm">
              <Gift className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-slate-900">
                  Quay thưởng buổi họp
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {meeting.title} · {meeting.speakers?.length || 0} người đã check-in
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? "Tắt âm thanh" : "Bật âm thanh"}
              className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-500 transition cursor-pointer"
            >
              {soundEnabled ? <Volume2 className="h-4 w-4 text-[#cf142b]" /> : <VolumeX className="h-4 w-4 text-slate-400" />}
            </button>
          </div>
        </div>

        {/* Game Options */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Game 1: Vòng quay may mắn */}
          <div className="group rounded-xl border border-slate-200 bg-slate-50/50 p-4 transition-all duration-200 hover:border-[#cf142b]/40 hover:shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="h-8 w-8 rounded-lg bg-[#cf142b] text-white flex items-center justify-center">
                  <Disc className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 group-hover:text-[#cf142b] transition">Vòng quay may mắn</h4>
                  <p className="text-[11px] text-slate-400">Đĩa quay 3D</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Quay đĩa tròn với tên thành viên, hiệu ứng âm thanh sống động.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200">
              <a
                href={`/quay-thuong?meetingId=${meeting._id}&game=wheel`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-lg bg-[#cf142b] hover:bg-[#b00f24] text-white py-2.5 text-xs font-medium shadow-sm transition active:scale-[0.98] cursor-pointer"
              >
                <Play className="h-4 w-4 fill-current" />
                Mở vòng quay
                <ExternalLink className="h-3.5 w-3.5 opacity-70" />
              </a>
            </div>
          </div>

          {/* Game 2: Lồng cầu Bingo */}
          <div className="group rounded-xl border border-slate-200 bg-slate-50/50 p-4 transition-all duration-200 hover:border-amber-400/60 hover:shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="h-8 w-8 rounded-lg bg-amber-500 text-white flex items-center justify-center">
                  <Dices className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 group-hover:text-amber-600 transition">Lồng cầu Bingo</h4>
                  <p className="text-[11px] text-slate-400">Quay xổ số 3D</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Lồng cầu 3D với các quả bóng số, mô phỏng vật lý thực tế.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200">
              <a
                href={`/quay-thuong?meetingId=${meeting._id}&game=bingo`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white py-2.5 text-xs font-medium shadow-sm transition active:scale-[0.98] cursor-pointer"
              >
                <Dices className="h-4 w-4" />
                Mở lồng cầu
                <ExternalLink className="h-3.5 w-3.5 opacity-70" />
              </a>
            </div>
          </div>
        </div>

        {/* Bốc thăm nhanh tại chỗ */}
        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-2">
            <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
              <Sparkles className="h-4 w-4 text-[#cf142b]" />
              <span>Bốc thăm nhanh tại chỗ</span>
            </div>

            {selectedPrize ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-50 text-[#cf142b] text-xs font-medium ring-1 ring-inset ring-red-200">
                <Gift className="h-3.5 w-3.5" />
                {selectedPrize.name} ({selectedPrize.winners.length}/{selectedPrize.quantity})
              </span>
            ) : (
              <span className="text-xs text-slate-400">Chọn giải thưởng bên dưới</span>
            )}
          </div>

          {/* Digital Display */}
          <div className="my-4 rounded-xl border border-slate-200 bg-white p-5 text-center">
            <div className="text-[11px] text-slate-400 mb-2">
              {luckyConfig.drawMode === "attendees" ? "Thành viên & Khách mời" : "Số may mắn"} · {meeting.speakers?.length || 0} ứng viên
            </div>

            <div
              className={`font-mono text-2xl sm:text-3xl font-semibold tracking-wider transition-all duration-75 select-none ${
                isSpinning
                  ? "text-[#cf142b] scale-105"
                  : "text-slate-800"
              }`}
            >
              {spinningDisplay}
            </div>
          </div>

          <div className="flex justify-center">
            <button
              type="button"
              disabled={!isMeetingStarted || !selectedPrize || isSpinning || (selectedPrize && selectedPrize.winners.length >= selectedPrize.quantity)}
              onClick={handleSpin}
              className={`px-6 py-3 rounded-lg text-sm font-medium transition-all duration-200 shadow-sm flex items-center gap-2 ${
                !isMeetingStarted
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                  : isSpinning
                  ? "bg-amber-500 text-white cursor-wait"
                  : selectedPrize && selectedPrize.winners.length >= selectedPrize.quantity
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                  : "bg-[#cf142b] hover:bg-[#b00f24] text-white hover:shadow-md active:scale-[0.97] cursor-pointer"
              }`}
            >
              {isSpinning ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Đang quay...</span>
                </>
              ) : !isMeetingStarted ? (
                <>
                  <Lock className="h-4 w-4" />
                  <span>Chưa bắt đầu</span>
                </>
              ) : selectedPrize && selectedPrize.winners.length >= selectedPrize.quantity ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Đã quay đủ</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Quay thưởng</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Danh sách giải thưởng */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-[#cf142b]" />
              Giải thưởng ({luckyConfig.prizes?.length || 0})
            </h4>
            <p className="text-xs text-slate-500">
              Chọn giải muốn quay hoặc thêm giải mới.
            </p>
          </div>

          {canManage && (
            <div className="flex items-center gap-2">
              {(!luckyConfig.prizes || luckyConfig.prizes.length === 0) && (
                <button
                  type="button"
                  onClick={handleApplyPresets}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-medium transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  Giải mẫu
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowConfigPanel(!showConfigPanel)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-medium transition flex items-center gap-1.5 cursor-pointer"
              >
                <Layers className="h-3.5 w-3.5 text-slate-400" />
                Cài đặt
              </button>

              <button
                type="button"
                onClick={openAddPrizeModal}
                className="px-3 py-1.5 rounded-lg bg-[#cf142b] hover:bg-[#b00f24] text-white text-xs font-medium shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Thêm giải
              </button>
            </div>
          )}
        </div>

        {/* Collapsible Settings Panel */}
        {showConfigPanel && canManage && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5 space-y-4">
            <h5 className="text-xs font-medium text-slate-700 uppercase tracking-wider">
              Cấu hình quay thưởng
            </h5>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <label className="space-y-1 block">
                <span className="font-semibold text-slate-700">Chế độ quay:</span>
                <select
                  value={luckyConfig.drawMode}
                  onChange={(e) => handleSaveSettings({ drawMode: e.target.value === 'numbers' ? 'numbers' : 'attendees' })}
                  className="w-full p-2 border border-slate-200 rounded-xl bg-white outline-none"
                >
                  <option value="attendees">Theo danh sách check-in họp</option>
                  <option value="numbers">Quay số may mắn (Min - Max)</option>
                </select>
              </label>

              <label className="space-y-1 block">
                <span className="font-semibold text-slate-700">Cho phép 1 người trúng nhiều giải:</span>
                <select
                  value={luckyConfig.allowRepeatWinners ? "yes" : "no"}
                  onChange={(e) => handleSaveSettings({ allowRepeatWinners: e.target.value === "yes" })}
                  className="w-full p-2 border border-slate-200 rounded-xl bg-white outline-none"
                >
                  <option value="no">Không (Chỉ trúng 1 lần)</option>
                  <option value="yes">Có (Có thể trúng nhiều giải)</option>
                </select>
              </label>

              {luckyConfig.drawMode === "numbers" && (
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1 block">
                    <span className="font-semibold text-slate-700">Số nhỏ nhất:</span>
                    <input
                      type="number"
                      min="1"
                      value={luckyConfig.numberMin}
                      onChange={(e) => handleSaveSettings({ numberMin: Number(e.target.value) })}
                      className="w-full p-2 border border-slate-200 rounded-xl bg-white outline-none"
                    />
                  </label>
                  <label className="space-y-1 block">
                    <span className="font-semibold text-slate-700">Số lớn nhất:</span>
                    <input
                      type="number"
                      min="1"
                      value={luckyConfig.numberMax}
                      onChange={(e) => handleSaveSettings({ numberMax: Number(e.target.value) })}
                      className="w-full p-2 border border-slate-200 rounded-xl bg-white outline-none"
                    />
                  </label>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Prizes Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {luckyConfig.prizes?.map((prize) => {
            const isSelected = prize.id === selectedPrizeId;
            const isCompleted = prize.winners.length >= prize.quantity;

            return (
              <div
                key={prize.id}
                onClick={() => setSelectedPrizeId(prize.id)}
                className={`relative rounded-2xl border p-4 transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? "border-amber-400 bg-amber-50/40 ring-2 ring-amber-400 shadow-md"
                    : "border-slate-200 bg-white hover:border-slate-300 shadow-xs"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-8 w-8 rounded-xl flex items-center justify-center text-white shadow-xs font-bold text-xs"
                        style={{ backgroundColor: prize.color || "#f59e0b" }}
                      >
                        {prize.order}
                      </div>
                      <div>
                        <h5 className="font-bold text-slate-900 text-sm">{prize.name}</h5>
                        <p className="text-xs text-slate-500 truncate max-w-[170px]" title={prize.reward}>
                          {prize.reward || "Chưa có phần thưởng"}
                        </p>
                      </div>
                    </div>

                    {isCompleted && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" />
                        Đủ
                      </span>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3">
                    <div className="flex justify-between text-[11px] font-mono text-slate-600 mb-1">
                      <span>Đã trao:</span>
                      <span className="font-bold">
                        {prize.winners.length} / {prize.quantity} giải
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, (prize.winners.length / prize.quantity) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Card footer actions */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-slate-400">
                    {isSelected ? "Đang chọn" : "Bấm để chọn"}
                  </span>

                  {canManage && (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => openEditPrizeModal(prize)}
                        className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg transition"
                        title="Chỉnh sửa giải"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePrize(prize.id)}
                        className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition"
                        title="Xóa giải"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Kết quả trúng thưởng */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-[#cf142b]" />
              Kết quả trúng thưởng
            </h4>
            <p className="text-xs text-slate-500">
              Danh sách người trúng giải trong buổi họp.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-medium transition flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-slate-400" />
              Xuất CSV
            </button>

            {canManage && (
              <button
                type="button"
                onClick={() => handleResetWinners()}
                className="px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-medium transition flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Đặt lại
              </button>
            )}
          </div>
        </div>

        {/* Winners List Table */}
        {(() => {
          const allWinners: Array<{ prize: LuckyDrawPrize; winner: LuckyDrawWinner }> = [];
          for (const p of luckyConfig.prizes || []) {
            for (const w of p.winners || []) {
              allWinners.push({ prize: p, winner: w });
            }
          }

          if (!allWinners.length) {
            return (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs italic">
                Chưa có ai trúng thưởng. Hãy kích hoạt cuộc họp và bấm "QUAY THƯỞNG" để tìm người may mắn!
              </div>
            );
          }

          return (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-medium uppercase tracking-wider text-slate-500">
                    <th className="p-3 pl-4">Giải thưởng</th>
                    <th className="p-3">Người trúng</th>
                    <th className="p-3">Số vé</th>
                    <th className="p-3">Thời gian</th>
                    {canManage && <th className="p-3 pr-4 text-right">Thao tác</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {allWinners.map(({ prize, winner }) => (
                    <tr key={winner.id} className="hover:bg-slate-50/60 transition">
                      <td className="p-3 pl-4">
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-white font-bold text-[11px]"
                          style={{ backgroundColor: prize.color || "#f59e0b" }}
                        >
                          <Trophy className="h-3 w-3" />
                          {prize.name}
                        </span>
                        <div className="text-[10px] text-slate-500 mt-0.5">{prize.reward}</div>
                      </td>

                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          {winner.photoURL ? (
                            <img
                              src={winner.photoURL}
                              alt={winner.name}
                              className="h-8 w-8 rounded-full object-cover border border-slate-200"
                            />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                              {winner.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-slate-900">{winner.name}</div>
                            {winner.email && (
                              <div className="text-[10px] text-slate-400 font-mono">{winner.email}</div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="p-3 font-mono font-bold text-slate-800">
                        {winner.ticketNumber ? `#${winner.ticketNumber}` : "—"}
                      </td>

                      <td className="p-3 font-mono text-[11px] text-slate-500">
                        {new Date(winner.wonAt).toLocaleTimeString("vi-VN")}{" "}
                        {new Date(winner.wonAt).toLocaleDateString("vi-VN")}
                      </td>

                      {canManage && (
                        <td className="p-3 pr-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleRedraw(winner)}
                            className="px-2.5 py-1 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[10px] transition cursor-pointer"
                            title="Hủy lượt trúng này để quay lại"
                          >
                            Quay lại
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })()}
      </div>

      {/* WINNER SPOTLIGHT CELEBRATION MODAL */}
      {activeWinnerModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-2xl border border-[#cf142b]/30 bg-white p-6 sm:p-8 text-slate-900 shadow-2xl text-center relative overflow-hidden">
            {/* Accent bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#cf142b] via-amber-500 to-[#cf142b]" />

            <div className="inline-flex p-3 rounded-xl bg-red-50 text-[#cf142b] mb-3">
              <Trophy className="h-7 w-7" />
            </div>

            <p className="text-xs uppercase tracking-widest text-[#cf142b] font-medium">
              Chúc mừng
            </p>
            <h4 className="text-xl font-semibold mt-1 text-slate-900">
              {activeWinnerModal.prize.name}
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              {activeWinnerModal.prize.reward}
            </p>

            {/* Winner Card */}
            <div className="my-5 p-4 rounded-xl border border-slate-200 bg-slate-50">
              <div className="flex flex-col items-center gap-3">
                {activeWinnerModal.winner.photoURL ? (
                  <img
                    src={activeWinnerModal.winner.photoURL}
                    alt={activeWinnerModal.winner.name}
                    className="h-16 w-16 rounded-xl border-2 border-[#cf142b] object-cover shadow-sm"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-xl border-2 border-[#cf142b] bg-[#cf142b] text-white flex items-center justify-center font-semibold text-xl">
                    {activeWinnerModal.winner.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <h5 className="text-lg font-semibold text-slate-900">
                    {activeWinnerModal.winner.name}
                  </h5>
                  {activeWinnerModal.winner.email && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      {activeWinnerModal.winner.email}
                    </p>
                  )}
                  {activeWinnerModal.winner.ticketNumber && (
                    <div className="inline-block mt-2 px-3 py-1 rounded-md bg-red-50 text-[#cf142b] text-xs font-medium ring-1 ring-inset ring-red-200">
                      Số may mắn: #{activeWinnerModal.winner.ticketNumber}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => handleRedraw(activeWinnerModal.winner)}
                className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-medium transition cursor-pointer"
              >
                Quay lại (Vắng mặt)
              </button>
              <button
                type="button"
                onClick={() => setActiveWinnerModal(null)}
                className="px-5 py-2 rounded-lg bg-[#cf142b] hover:bg-[#b00f24] text-white text-xs font-medium transition shadow-sm cursor-pointer"
              >
                Xác nhận nhận giải
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT PRIZE MODAL */}
      {isPrizeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="bg-white border-b border-slate-100 p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-50 text-amber-500 rounded-xl border border-amber-100/80 shadow-xs">
                  <Trophy className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    {editingPrize ? "Sửa giải thưởng" : "Thêm giải thưởng mới"}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {editingPrize ? "Cập nhật thông tin chi tiết giải thưởng" : "Thiết lập giải thưởng mới cho vòng quay"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPrizeModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSavePrize} className="p-5 space-y-4">
              <div className="space-y-1 text-left text-xs">
                <label className="font-bold text-slate-700 block">Tên giải thưởng *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Giải Nhất, Giải Đặc Biệt..."
                  value={prizeName}
                  onChange={(e) => setPrizeName(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#0088A9]"
                />
              </div>

              <div className="space-y-1 text-left text-xs">
                <label className="font-bold text-slate-700 block">Phần thưởng / Trị giá</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Xe máy Honda Wave, 5.000.000đ tiền mặt..."
                  value={prizeReward}
                  onChange={(e) => setPrizeReward(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#0088A9]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs text-left">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Số lượng giải</label>
                  <input
                    type="number"
                    min="1"
                    value={prizeQuantity}
                    onChange={(e) => setPrizeQuantity(Number(e.target.value))}
                    className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#0088A9]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Thứ tự quay</label>
                  <input
                    type="number"
                    min="1"
                    value={prizeOrder}
                    onChange={(e) => setPrizeOrder(Number(e.target.value))}
                    className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#0088A9]"
                  />
                </div>
              </div>

              <div className="space-y-1 text-left text-xs">
                <label className="font-bold text-slate-700 block">Màu sắc đại diện</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={prizeColor}
                    onChange={(e) => setPrizeColor(e.target.value)}
                    className="h-9 w-12 rounded-lg cursor-pointer border border-slate-200"
                  />
                  <span className="font-mono text-slate-500 text-xs">{prizeColor}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPrizeModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={savingPrize}
                  className="px-5 py-2 rounded-xl bg-[#0088A9] hover:bg-[#007490] text-white text-xs font-bold shadow-md shadow-cyan-900/10 cursor-pointer disabled:opacity-50"
                >
                  {savingPrize ? "Đang lưu..." : "Lưu giải thưởng"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOM CONFIRM POPUP (replaces window.confirm) */}
      {confirmModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-xl border border-slate-200 overflow-hidden">
            <div className="p-5">
              <div className="flex items-start gap-3">
                <div className="shrink-0 p-2 rounded-lg bg-amber-50 text-amber-500">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">Xác nhận</h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {confirmModal.message}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 bg-slate-50 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-medium hover:bg-slate-50 transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal(null);
                }}
                className="px-4 py-2 rounded-lg bg-[#cf142b] hover:bg-[#b00f24] text-white text-xs font-medium shadow-sm transition cursor-pointer"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
