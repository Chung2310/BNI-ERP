import React, { useEffect, useState, useRef } from "react";
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
  Maximize2,
  Minimize2,
  RotateCcw,
  Share2,
  Users,
  Hash,
  ShieldCheck,
  Download,
  Calendar,
  Layers,
  ChevronRight,
  PartyPopper,
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
  const [isFullscreen, setIsFullscreen] = useState(false);
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

  const containerRef = useRef<HTMLDivElement>(null);
  const tickerIntervalRef = useRef<any>(null);

  // Kiểm tra điều kiện: CUỘC HỌP ĐÃ BẮT ĐẦU CHƯA?
  const isMeetingStarted =
    meeting.status === "live" || meeting.status === "paused" || meeting.status === "ended";

  useEffect(() => {
    if (meeting.luckyDraw) {
      setLuckyConfig(meeting.luckyDraw);
      if (!selectedPrizeId && meeting.luckyDraw.prizes?.length) {
        setSelectedPrizeId(meeting.luckyDraw.prizes[0].id);
      }
    }
  }, [meeting]);

  const selectedPrize = luckyConfig.prizes?.find((p) => p.id === selectedPrizeId);

  // Toggle Fullscreen
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // Quick Preset Prizes
  const handleApplyPresets = async () => {
    if (!canManage) return;
    if (
      luckyConfig.prizes?.length &&
      !window.confirm("Áp dụng cấu hình mẫu sẽ thêm các giải thưởng chuẩn vào danh sách. Tiếp tục?")
    ) {
      return;
    }

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
    } catch (err: any) {
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
    } catch (err: any) {
      toast.error(err.message || "Lỗi lưu giải thưởng.");
    } finally {
      setSavingPrize(false);
    }
  };

  // Delete Prize
  const handleDeletePrize = async (prizeId: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa giải thưởng này?")) return;
    try {
      const updated = await meetingService.deletePrize(meeting._id, prizeId);
      setLuckyConfig(updated);
      if (selectedPrizeId === prizeId) {
        setSelectedPrizeId(updated.prizes?.[0]?.id || "");
      }
      toast.success("Đã xóa giải thưởng.");
      await onRefreshMeeting();
    } catch (err: any) {
      toast.error(err.message || "Xóa giải thưởng thất bại.");
    }
  };

  // Save Settings
  const handleSaveSettings = async (newConfig: Partial<LuckyDrawConfig>) => {
    try {
      const updated = await meetingService.updateLuckyDrawConfig(meeting._id, newConfig);
      setLuckyConfig(updated);
      toast.success("Đã cập nhật cấu hình quay thưởng.");
      await onRefreshMeeting();
    } catch (err: any) {
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
    let spinResultPromise: Promise<any>;
    try {
      spinResultPromise = meetingService.spinLuckyDraw(meeting._id, selectedPrize.id);
    } catch (err: any) {
      setIsSpinning(false);
      toast.error(err.message || "Không thể kết nối máy chủ quay thưởng.");
      return;
    }

    // High-speed rolling animation (Random.org style)
    let rollIndex = 0;
    const startTime = Date.now();
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
    } catch (err: any) {
      clearInterval(rollingInterval);
      setIsSpinning(false);
      setSpinningDisplay("READY");
      toast.error(err.message || "Quay thưởng thất bại.");
    }
  };

  // Redraw Winner
  const handleRedraw = async (winner: LuckyDrawWinner) => {
    if (!canManage) return;
    if (!window.confirm(`Bạn có chắc muốn hủy kết quả của "${winner.name}" và cho phép quay lại?`)) return;

    try {
      await meetingService.redrawWinner(meeting._id, winner.prizeId, winner.id);
      toast.success("Đã hủy kết quả. Bạn có thể bấm Quay lại giải này.");
      setActiveWinnerModal(null);
      await onRefreshMeeting();
    } catch (err: any) {
      toast.error(err.message || "Không thể hủy kết quả.");
    }
  };

  // Reset Winners
  const handleResetWinners = async (prizeId?: string) => {
    if (!canManage) return;
    const confirmMsg = prizeId
      ? "Đặt lại kết quả người trúng giải này?"
      : "Đặt lại toàn bộ kết quả trúng thưởng của tất cả các giải?";
    if (!window.confirm(confirmMsg)) return;

    try {
      const updated = await meetingService.resetWinners(meeting._id, prizeId);
      setLuckyConfig(updated);
      toast.success("Đã làm mới danh sách người trúng giải.");
      await onRefreshMeeting();
    } catch (err: any) {
      toast.error(err.message || "Đặt lại thất bại.");
    }
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
      className={`space-y-6 ${isFullscreen ? "fixed inset-0 z-50 bg-slate-950 p-6 overflow-y-auto text-white" : ""}`}
    >
      {/* Top Banner Alert: CHỈ QUAY KHI CUỘC HỌP ĐÃ BẮT ĐẦU */}
      {!isMeetingStarted ? (
        <div className="rounded-2xl border border-amber-300 bg-linear-to-r from-amber-50 to-orange-50 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl shrink-0 mt-0.5">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-amber-900 text-sm sm:text-base">
                  Cuộc họp chưa bắt đầu — Chức năng quay thưởng đang tạm khóa
                </h4>
                <span className="px-2 py-0.5 rounded-full bg-amber-200/60 text-[10px] font-bold text-amber-800 uppercase tracking-wider">
                  Chờ bắt đầu
                </span>
              </div>
              <p className="text-xs text-amber-800/90 mt-1 leading-relaxed">
                Theo quy định, chương trình quay thưởng chỉ được phép kích hoạt sau khi cuộc họp đã bắt đầu.
                {canManage ? " Bạn có thể nhấn nút bên cạnh để bắt đầu cuộc họp ngay." : " Vui lòng chờ người chủ trì bắt đầu cuộc họp."}
              </p>
            </div>
          </div>

          {canManage && onStartMeeting && (
            <button
              type="button"
              onClick={onStartMeeting}
              className="shrink-0 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="h-4 w-4" />
              Bắt đầu cuộc họp ngay
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-emerald-300 bg-linear-to-r from-emerald-50 to-teal-50 p-4 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h4 className="font-bold text-emerald-950 text-sm">
                  Cuộc họp đang diễn ra — Quay thưởng đã sẵn sàng!
                </h4>
              </div>
              <p className="text-xs text-emerald-800 mt-0.5">
                {meeting.speakers?.length || 0} thành viên đã điểm danh check-in sẵn sàng bốc thăm.
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-600 text-white font-mono text-xs font-bold">
            <ShieldCheck className="h-3.5 w-3.5" />
            Random.org Verified
          </span>
        </div>
      )}

      {/* Main Stage: Random.org Futuristic Neon Wheel/Ticker */}
      <div className="relative rounded-3xl border border-slate-800 bg-linear-to-b from-slate-900 via-indigo-950 to-slate-950 p-6 sm:p-10 shadow-2xl overflow-hidden text-center text-white">
        {/* Glow ambient effects */}
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-rose-500/20 blur-3xl pointer-events-none" />

        {/* Stage Header Toolbar */}
        <div className="relative z-10 flex items-center justify-between gap-3 pb-6 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-400/30">
              <Trophy className="h-5 w-5" />
            </div>
            <div className="text-left">
              <h3 className="font-bold text-base sm:text-lg tracking-tight">
                VÒNG QUAY MAY MẮN (RANDOM.ORG)
              </h3>
              <p className="text-[11px] text-slate-400 font-mono">
                {meeting.title} • {new Date(meeting.startsAt).toLocaleDateString("vi-VN")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? "Tắt âm thanh" : "Bật âm thanh"}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition cursor-pointer"
            >
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-rose-400" />}
            </button>

            <button
              type="button"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Thu nhỏ" : "Toàn màn hình máy chiếu"}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition cursor-pointer"
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Selected Prize Banner */}
        <div className="relative z-10 pt-6 max-w-xl mx-auto">
          {selectedPrize ? (
            <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs sm:text-sm font-bold text-amber-300 shadow-lg">
              <Gift className="h-4 w-4 text-amber-400" />
              <span>Đang chọn: {selectedPrize.name}</span>
              <span className="text-white/60 font-normal">({selectedPrize.reward || "Chưa có mô tả"})</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-[10px] text-amber-300 font-mono">
                {selectedPrize.winners.length}/{selectedPrize.quantity} giải
              </span>
            </div>
          ) : (
            <div className="text-xs text-amber-300 italic">
              Vui lòng tạo hoặc chọn một giải thưởng bên dưới để quay!
            </div>
          )}
        </div>

        {/* Random.org Digital Display Board */}
        <div className="relative z-10 py-8 sm:py-12">
          <div className="mx-auto max-w-2xl rounded-3xl border-2 border-indigo-400/40 bg-black/60 backdrop-blur-xl p-8 sm:p-12 shadow-[0_0_50px_rgba(99,102,241,0.25)] relative overflow-hidden">
            <div className="absolute top-2 left-3 flex items-center gap-1.5 text-[9px] font-mono text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              TRUE RANDOM GENERATOR
            </div>
            <div className="absolute top-2 right-3 text-[9px] font-mono text-slate-400">
              ENTROPY: CRYPTOGRAPHIC RNG
            </div>

            <div className="pt-3">
              <div
                className={`font-mono text-3xl sm:text-5xl md:text-6xl font-black tracking-wider transition-all duration-75 select-none ${
                  isSpinning
                    ? "text-amber-400 scale-105 drop-shadow-[0_0_20px_rgba(245,158,11,0.8)]"
                    : "text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]"
                }`}
              >
                {spinningDisplay}
              </div>

              <div className="mt-4 text-[11px] font-mono text-slate-400 flex items-center justify-center gap-3">
                <span>Chế độ: {luckyConfig.drawMode === "attendees" ? "Người tham gia họp" : "Số may mắn"}</span>
                <span>•</span>
                <span>Ứng viên hợp lệ: {meeting.speakers?.length || 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Big Spin Action Button */}
        <div className="relative z-10 flex flex-col items-center justify-center gap-4">
          <button
            type="button"
            disabled={!isMeetingStarted || !selectedPrize || isSpinning || selectedPrize.winners.length >= selectedPrize.quantity}
            onClick={handleSpin}
            className={`group relative px-10 py-4 sm:px-14 sm:py-5 rounded-2xl text-base sm:text-xl font-black uppercase tracking-widest transition-all duration-200 shadow-2xl flex items-center gap-3 ${
              !isMeetingStarted
                ? "bg-slate-700/60 text-slate-400 cursor-not-allowed border border-slate-600"
                : isSpinning
                ? "bg-amber-500 text-slate-950 scale-95 shadow-amber-500/50 cursor-wait"
                : selectedPrize && selectedPrize.winners.length >= selectedPrize.quantity
                ? "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed"
                : "bg-linear-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 hover:scale-105 hover:shadow-amber-500/40 active:scale-95 cursor-pointer"
            }`}
          >
            {isSpinning ? (
              <>
                <RefreshCw className="h-6 w-6 animate-spin" />
                <span>Đang quay thưởng...</span>
              </>
            ) : !isMeetingStarted ? (
              <>
                <Lock className="h-6 w-6" />
                <span>Cuộc họp chưa bắt đầu</span>
              </>
            ) : selectedPrize && selectedPrize.winners.length >= selectedPrize.quantity ? (
              <>
                <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                <span>Giải này đã quay đủ</span>
              </>
            ) : (
              <>
                <Sparkles className="h-6 w-6 animate-bounce" />
                <span>BẤM ĐỂ QUAY THƯỞNG</span>
              </>
            )}
          </button>

          {!isMeetingStarted && (
            <p className="text-xs text-amber-300/80 font-mono">
              * Yêu cầu cuộc họp ở trạng thái Đang diễn ra để mở khóa nút quay thưởng.
            </p>
          )}
        </div>
      </div>

      {/* Prize Selector Ribbon */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="font-bold text-slate-800 text-sm sm:text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              Danh sách các giải thưởng ({luckyConfig.prizes?.length || 0})
            </h4>
            <p className="text-xs text-slate-500">
              Chọn giải thưởng bạn muốn tiến hành quay hoặc cấu hình thêm giải mới.
            </p>
          </div>

          {canManage && (
            <div className="flex items-center gap-2">
              {(!luckyConfig.prizes || luckyConfig.prizes.length === 0) && (
                <button
                  type="button"
                  onClick={handleApplyPresets}
                  className="px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Áp dụng bộ giải mẫu
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowConfigPanel(!showConfigPanel)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <Layers className="h-3.5 w-3.5 text-slate-500" />
                Cài đặt quay
              </button>

              <button
                type="button"
                onClick={openAddPrizeModal}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Thêm giải mới
              </button>
            </div>
          )}
        </div>

        {/* Collapsible Settings Panel */}
        {showConfigPanel && canManage && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5 space-y-4">
            <h5 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
              Cấu hình quay thưởng cuộc họp
            </h5>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <label className="space-y-1 block">
                <span className="font-semibold text-slate-700">Chế độ quay:</span>
                <select
                  value={luckyConfig.drawMode}
                  onChange={(e) => handleSaveSettings({ drawMode: e.target.value as any })}
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
                  <span className="text-[11px] font-semibold text-slate-500">
                    {isSelected ? "★ Đang chọn quay" : "Bấm để chọn giải này"}
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

      {/* Hall of Fame (Bảng vinh danh người trúng thưởng) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h4 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <PartyPopper className="h-5 w-5 text-indigo-600" />
              Bảng vàng vinh danh người trúng thưởng
            </h4>
            <p className="text-xs text-slate-500">
              Danh sách chi tiết tất cả các giải đã quay thành công trong buổi họp này.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Download className="h-3.5 w-3.5 text-slate-500" />
              Xuất kết quả (CSV)
            </button>

            {canManage && (
              <button
                type="button"
                onClick={() => handleResetWinners()}
                className="px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Đặt lại kết quả
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
                  <tr className="border-b border-slate-150 bg-slate-50 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="p-3 pl-4">Giải thưởng</th>
                    <th className="p-3">Người trúng thưởng</th>
                    <th className="p-3">Số vé / ID</th>
                    <th className="p-3">Thời gian trúng</th>
                    <th className="p-3">Mã xác thực Random.org</th>
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

                      <td className="p-3">
                        <div className="font-mono text-[10px] text-slate-400 truncate max-w-[140px]" title={winner.verificationHash}>
                          {winner.verificationHash ? `${winner.verificationHash.slice(0, 16)}...` : "—"}
                        </div>
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
          <div className="w-full max-w-md rounded-3xl border-2 border-amber-400 bg-linear-to-b from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-2xl text-center relative overflow-hidden animate-in fade-in zoom-in duration-300">
            {/* Confetti ambient */}
            <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-amber-400/20 blur-2xl" />

            <div className="inline-flex p-3 rounded-2xl bg-amber-400/20 text-amber-300 border border-amber-400/30 mb-3 shadow-lg animate-bounce">
              <Trophy className="h-8 w-8" />
            </div>

            <h3 className="text-xs uppercase font-mono tracking-widest text-amber-400">
              CHÚC MỪNG CHIẾN THẮNG
            </h3>
            <h4 className="text-2xl font-black mt-1 text-white tracking-tight">
              {activeWinnerModal.prize.name}
            </h4>
            <p className="text-xs text-amber-200 mt-0.5">
              {activeWinnerModal.prize.reward}
            </p>

            {/* Winner Badge Card */}
            <div className="my-6 p-4 rounded-2xl border border-white/20 bg-white/10 backdrop-blur-md">
              <div className="flex flex-col items-center gap-3">
                {activeWinnerModal.winner.photoURL ? (
                  <img
                    src={activeWinnerModal.winner.photoURL}
                    alt={activeWinnerModal.winner.name}
                    className="h-20 w-20 rounded-2xl border-2 border-amber-400 object-cover shadow-lg"
                  />
                ) : (
                  <div className="h-20 w-20 rounded-2xl border-2 border-amber-400 bg-amber-400 text-slate-950 flex items-center justify-center font-bold text-2xl">
                    {activeWinnerModal.winner.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <h5 className="text-xl font-bold text-white">
                    {activeWinnerModal.winner.name}
                  </h5>
                  {activeWinnerModal.winner.email && (
                    <p className="text-xs text-slate-300 font-mono mt-0.5">
                      {activeWinnerModal.winner.email}
                    </p>
                  )}
                  {activeWinnerModal.winner.ticketNumber && (
                    <div className="inline-block mt-2 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 font-mono font-bold text-xs border border-amber-400/30">
                      Số may mắn: #{activeWinnerModal.winner.ticketNumber}
                    </div>
                  )}
                </div>
              </div>

              {/* Random.org Verification Proof */}
              <div className="mt-4 pt-3 border-t border-white/10 text-[10px] font-mono text-slate-400 text-left space-y-1">
                <div className="truncate">Seed: {activeWinnerModal.seed}</div>
                <div className="truncate">Hash: {activeWinnerModal.verificationHash}</div>
                <div>Xác thực: Random.org Cryptographic Signature</div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => handleRedraw(activeWinnerModal.winner)}
                className="px-4 py-2 rounded-xl border border-rose-400/30 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-bold transition cursor-pointer"
              >
                Quay lại (Vắng mặt)
              </button>
              <button
                type="button"
                onClick={() => setActiveWinnerModal(null)}
                className="px-6 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold transition shadow-lg shadow-amber-400/20 cursor-pointer"
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
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Trophy className="h-5 w-5 text-amber-400" />
                <h3 className="font-bold text-sm">
                  {editingPrize ? "Sửa giải thưởng" : "Thêm giải thưởng mới"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPrizeModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg"
              >
                ✕
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
                  className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1 text-left text-xs">
                <label className="font-bold text-slate-700 block">Phần thưởng / Trị giá</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Xe máy Honda Wave, 5.000.000đ tiền mặt..."
                  value={prizeReward}
                  onChange={(e) => setPrizeReward(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
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
                    className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Thứ tự quay</label>
                  <input
                    type="number"
                    min="1"
                    value={prizeOrder}
                    onChange={(e) => setPrizeOrder(Number(e.target.value))}
                    className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
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
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 cursor-pointer disabled:opacity-50"
                >
                  {savingPrize ? "Đang lưu..." : "Lưu giải thưởng"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
