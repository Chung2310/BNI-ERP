import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Sparkles,
  Trophy,
  Gift,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Users,
  UserPlus,
  Trash2,
  Shuffle,
  RotateCcw,
  Search,
  X,
  Download,
  Check,
  Play,
  UserMinus,
  Settings2,
  Award,
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
  RefreshCw,
  Clock,
  Dices,
  Disc,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { authService } from "../services/authService";
import { meetingService, Meeting, Speaker } from "../services/meetingService";
import { UserProfile } from "../types";
import { playTickSound, playWinFanfare, playSuspenseSound } from "../utils/soundEffects";
import { launchConfetti } from "../utils/confetti";
import { BRAND_NAME, BRAND_LOGO_PATH } from "../config/brand";

export type ParticipantType = "member_present" | "member_absent" | "guest";
export type ParticipantFilterCategory = "all" | "all_members" | "present_members" | "guests";

interface Participant {
  id: string;
  name: string;
  avatar?: string;
  department?: string;
  role?: string;
  selected: boolean;
  isCustom?: boolean;
  type?: ParticipantType;
  checkedInAt?: string;
}

interface WinnerRecord {
  source?: "wheel" | "bingo";
  id: string;
  name: string;
  prizeName: string;
  avatar?: string;
  department?: string;
  wonAt: string;
}

// Legacy 12-Color palette for drawer tags & avatars
const WHEEL_PALETTE = [
  "#ef4444", "#f97316", "#f59e0b", "#10b981", "#06b6d4", "#3b82f6",
  "#6366f1", "#8b5cf6", "#d946ef", "#ec4899", "#14b8a6", "#84cc16",
];

// Ultra-Luxury 3-Tone Shading Palette for Wheel Slices
interface LuxuryColor {
  start: string; // Outer highlight sheen
  mid: string;   // Rich vibrant body
  end: string;   // Inner deep shadow
  text: string;  // High-contrast label color
}

const LUXURY_PALETTE: LuxuryColor[] = [
  { start: "#ff4d6d", mid: "#cf142b", end: "#800a18", text: "#ffffff" }, // BNI Crimson Red
  { start: "#fde047", mid: "#f59e0b", end: "#b45309", text: "#1e1b4b" }, // BNI Imperial Gold
  { start: "#34d399", mid: "#059669", end: "#064e3b", text: "#ffffff" }, // Emerald Jade
  { start: "#60a5fa", mid: "#2563eb", end: "#1e3a8a", text: "#ffffff" }, // Royal Sapphire Blue
  { start: "#fb923c", mid: "#ea580c", end: "#7c2d12", text: "#ffffff" }, // Sunset Tangerine
  { start: "#c084fc", mid: "#9333ea", end: "#581c87", text: "#ffffff" }, // Amethyst Purple
  { start: "#38bdf8", mid: "#0284c7", end: "#075985", text: "#ffffff" }, // Bright Topaz Cyan
  { start: "#f472b6", mid: "#db2777", end: "#831843", text: "#ffffff" }, // Hot Cerise Magenta
  { start: "#a3e635", mid: "#65a30d", end: "#365314", text: "#1a2e05" }, // Electric Lime
  { start: "#2dd4bf", mid: "#0d9488", end: "#134e4a", text: "#ffffff" }, // Tropical Teal
  { start: "#818cf8", mid: "#4f46e5", end: "#312e81", text: "#ffffff" }, // Royal Indigo
  { start: "#e879f9", mid: "#c026d3", end: "#701a75", text: "#ffffff" }, // Neon Orchid
];

// Luxury 3D Lottery Ball Palette for Bingo Cage
export const LOTTERY_BALL_PALETTE = [
  { start: "#ff6b81", mid: "#cf142b", end: "#800a18", text: "#ffffff" }, // BNI Crimson Red
  { start: "#fef08a", mid: "#f59e0b", end: "#b45309", text: "#1e1b4b" }, // Imperial Gold
  { start: "#6ee7b7", mid: "#059669", end: "#064e3b", text: "#ffffff" }, // Emerald Jade
  { start: "#93c5fd", mid: "#2563eb", end: "#1e3a8a", text: "#ffffff" }, // Royal Sapphire
  { start: "#fdba74", mid: "#ea580c", end: "#7c2d12", text: "#ffffff" }, // Sunset Orange
  { start: "#d8b4fe", mid: "#9333ea", end: "#581c87", text: "#ffffff" }, // Amethyst Purple
  { start: "#7dd3fc", mid: "#0284c7", end: "#075985", text: "#ffffff" }, // Bright Cyan
  { start: "#f9a8d4", mid: "#db2777", end: "#831843", text: "#ffffff" }, // Hot Cerise Pink
  { start: "#bef264", mid: "#65a30d", end: "#365314", text: "#1a2e05" }, // Electric Lime
  { start: "#5eead4", mid: "#0d9488", end: "#134e4a", text: "#ffffff" }, // Tropical Teal
];

export interface BingoBallPhysics {
  participant: Participant;
  ballNumber: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  colorIdx: number;
  rotation: number;
}

export const initBingoBalls = (active: Participant[], cageRadius: number): BingoBallPhysics[] => {
  const count = active.length;
  if (count === 0) return [];
  const maxDisplay = Math.min(count, 50);
  const r = Math.max(14, Math.min(22, (cageRadius * 0.48) / Math.sqrt(maxDisplay + 4)));

  return active.slice(0, maxDisplay).map((p, i) => {
    const phi = Math.PI * 0.2 + Math.random() * (Math.PI * 0.6);
    const dist = (0.2 + Math.random() * 0.65) * (cageRadius - r - 6);
    const x = Math.cos(phi) * dist;
    const y = Math.sin(phi) * dist;

    return {
      participant: p,
      ballNumber: i + 1,
      x,
      y,
      vx: (Math.random() - 0.5) * 1.5,
      vy: (Math.random() - 0.5) * 1.5,
      radius: r,
      colorIdx: i % LOTTERY_BALL_PALETTE.length,
      rotation: Math.random() * Math.PI * 2,
    };
  });
};

export const drawCanvasRoundRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) => {
  ctx.beginPath();
  if (typeof (ctx as any).roundRect === "function") {
    (ctx as any).roundRect(x, y, w, h, r);
  } else {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
};

export interface DisplaySlice {
  participant: Participant;
  displayName: string;
  paletteIndex: number;
}

// Exactly 1 slice per active participant (1:1 mapping, no duplicate names, no icons)
export const getDisplaySlices = (active: Participant[]): DisplaySlice[] => {
  return active.map((p, i) => ({
    participant: p,
    displayName: p.name,
    paletteIndex: i % LUXURY_PALETTE.length,
  }));
};


export const matchesFilterCategory = (p: Participant, category: ParticipantFilterCategory): boolean => {
  const pType = p.type || "member_present";
  switch (category) {
    case "all":
      // Tất cả thành viên (bao gồm cả vắng mặt) + khách tham dự hôm nay
      return true;
    case "all_members":
      // Tất cả thành viên chapter (cả có mặt và vắng mặt)
      return pType === "member_present" || pType === "member_absent";
    case "present_members":
      // Chỉ thành viên có mặt
      return pType === "member_present";
    case "guests":
      // Chỉ khách mời
      return pType === "guest";
    default:
      return true;
  }
};

export default function WheelOfNamesPage() {
  const { userProfile, loading: authLoading } = useAuth();

  // Query Params for meeting-specific lucky draw
  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const urlMeetingId = searchParams?.get("meetingId") || searchParams?.get("id");
  const urlGame = searchParams?.get("game");

  // State
  const [selectedGame, setSelectedGame] = useState<"wheel" | "bingo">(
    urlGame === "bingo" ? "bingo" : "wheel"
  );
  const [resultMeetingId, setResultMeetingId] = useState<string | null>(urlMeetingId);
  type PendingResult = { meetingId: string; winner: Parameters<typeof meetingService.recordGameWinner>[1] };
  const [unsavedResults, setUnsavedResults] = useState<PendingResult[]>([]);
  const saveResult = async (entry: PendingResult) => {
    try {
      await meetingService.recordGameWinner(entry.meetingId, entry.winner);
      setUnsavedResults(previous => previous.filter(result => result.winner.id !== entry.winner.id));
    } catch (error) { console.error("Không thể lưu kết quả quay thưởng:", error); }
  };
  const persistWinner = (record: WinnerRecord, participant: Participant, source: "wheel" | "bingo", ticketNumber?: number) => {
    if (!resultMeetingId) return;
    const entry: PendingResult = { meetingId: resultMeetingId, winner: {
      id: record.id, winnerId: participant.id, name: participant.name, prizeName: record.prizeName,
      photoURL: participant.avatar, source, ticketNumber, wonAt: record.wonAt,
    } };
    setUnsavedResults(previous => [...previous, entry]);
    void saveResult(entry);
  };
  const [meetingTitle, setMeetingTitle] = useState<string>("");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [winners, setWinners] = useState<WinnerRecord[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [newGuestName, setNewGuestName] = useState("");
  const [filterCategory, setFilterCategory] = useState<ParticipantFilterCategory>("all");
  const [currentPrize, setCurrentPrize] = useState("Giải Thưởng May Mắn");
  const [isEditingPrize, setIsEditingPrize] = useState(false);
  const [prizeInput, setPrizeInput] = useState(currentPrize);

  // Sound & Screen settings
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [spinDuration, setSpinDuration] = useState(8); // in seconds
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);
  const [activeDrawerTab, setActiveDrawerTab] = useState<"participants" | "winners">("participants");

  // Spin mechanics
  const [isSpinning, setIsSpinning] = useState(false);
  const [winnerModal, setWinnerModal] = useState<{
    winner: Participant;
    prize: string;
    ballNumber?: number;
  } | null>(null);

  // Canvas & Physics Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentAngleRef = useRef(0);
  const animationFrameIdRef = useRef<number | null>(null);
  const lastTickIndexRef = useRef<number>(-1);
  const pointerBounceRef = useRef(0);
  const lightPhaseRef = useRef(0);
  const pulseAnimRef = useRef(0);

  // Bingo Cage Refs
  const bingoBallsRef = useRef<BingoBallPhysics[]>([]);
  const cageAngleRef = useRef(0);
  const winningBallDropRef = useRef<{
    ball: BingoBallPhysics;
    progress: number;
  } | null>(null);

  // Filtered by Category
  const categoryParticipants = participants.filter((p) => matchesFilterCategory(p, filterCategory));

  // Active selected participants on the wheel
  const activeParticipants = categoryParticipants.filter((p) => p.selected);

  // Participant counts by category
  const countAll = participants.length;
  const countAllMembers = participants.filter(
    (p) => p.type === "member_present" || p.type === "member_absent"
  ).length;
  const countPresent = participants.filter((p) => p.type === "member_present").length;
  const countGuests = participants.filter((p) => p.type === "guest").length;

  // 1. Fetch Users & Today's Meeting Check-in status directly from system
  const loadSystemUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      let users: UserProfile[] = [];
      if (userProfile?.companyCode) {
        try {
          users = await authService.getUsersByCompany(userProfile.companyCode);
        } catch {
          users = await authService.getColleagues();
        }
      } else {
        try {
          users = await authService.getColleagues();
        } catch {
          users = [];
        }
      }

      // Fetch meetings to get check-in attendees (speakers & guests)
      let meetings: Meeting[] = [];
      try {
        meetings = await meetingService.listMeetings();
      } catch (e) {
        console.warn("Không thể tải danh sách cuộc họp cho vòng quay:", e);
      }

      // Prioritize meeting with checked-in speakers:
      // Prioritize target meeting:
      // 0. If urlMeetingId is passed in URL query, target that exact meeting
      // 1. Live or paused meeting with speakers
      // 2. Today's meeting with speakers
      // 3. Most recent meeting that has speakers
      // 4. Any meeting that has speakers
      const now = new Date();
      const isSameDate = (d1: Date, d2: Date) =>
        d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();

      let targetMeeting: Meeting | undefined;

      if (urlMeetingId) {
        targetMeeting = meetings.find((m) => String(m._id) === String(urlMeetingId));
      }

      if (!targetMeeting) {
        targetMeeting = meetings.find(
          (m) => (m.status === "live" || m.status === "paused") && m.speakers && m.speakers.length > 0
        );
      }

      if (!targetMeeting) {
        targetMeeting = meetings.find((m) => {
          if (!m.startsAt || !m.speakers || m.speakers.length === 0) return false;
          return isSameDate(new Date(m.startsAt), now);
        });
      }

      if (!targetMeeting) {
        const sortedWithSpeakers = meetings
          .filter((m) => m.speakers && m.speakers.length > 0)
          .sort((a, b) => new Date(b.startsAt || 0).getTime() - new Date(a.startsAt || 0).getTime());
        if (sortedWithSpeakers.length > 0) {
          targetMeeting = sortedWithSpeakers[0];
        }
      }

      if (!targetMeeting && meetings.length > 0) {
        targetMeeting = meetings.find((m) => m.status === "live" || m.status === "paused") || meetings[0];
      }

      if (targetMeeting) {
        setResultMeetingId(targetMeeting._id);
        setWinners((targetMeeting.gameWinners || []).map((winner): WinnerRecord => ({
          id: winner.id, name: winner.name, prizeName: winner.prizeName,
          avatar: winner.photoURL, wonAt: winner.wonAt, source: (winner.source === "bingo" ? "bingo" : "wheel") as "wheel" | "bingo",
        })).reverse());
        setMeetingTitle(targetMeeting.title);
        if (targetMeeting.luckyDraw?.prizes?.length) {
          const firstPrize = targetMeeting.luckyDraw.prizes[0];
          setCurrentPrize(firstPrize.name);
          setPrizeInput(firstPrize.name);
        }
      }

      // Collect speakers from target meeting, or fallback merge all speakers from recent meetings if target has none
      let speakers: Speaker[] = targetMeeting?.speakers || [];
      if (speakers.length === 0) {
        const seenSpeakerIds = new Set<string>();
        for (const m of meetings) {
          for (const s of m.speakers || []) {
            if (!seenSpeakerIds.has(s.id)) {
              seenSpeakerIds.add(s.id);
              speakers.push(s);
            }
          }
        }
      }

      // Build chapter members roster from DB users
      const userMap = new Map<string, { id: string; name: string; avatar?: string; department?: string; role?: string }>();

      // Add DB users
      for (const u of users) {
        const uid = String(u.uid || (u as any).id || (u as any)._id || u.email || "").trim();
        const uName = (u.displayName || u.email?.split("@")[0] || "Thành viên").trim();
        userMap.set(uName.toLowerCase(), {
          id: uid || `user-${Math.random()}`,
          name: uName,
          avatar: u.photoURL,
          department: u.department || u.branchName || "Ban Giám Đốc",
          role: u.role === "admin" ? "Chủ tịch / Admin" : u.role || "Thành viên",
        });
      }


      // Match speakers to members
      const matchedSpeakerIds = new Set<string>();

      const isSpeakerMatch = (s: Speaker, mName: string, mId: string): boolean => {
        const sUserId = String(s.userId || "").trim();
        const sName = (s.name || "").trim().toLowerCase();
        const nameToMatch = mName.trim().toLowerCase();

        if (sUserId && mId && sUserId === mId) return true;
        if (sName && nameToMatch && (sName === nameToMatch || sName.includes(nameToMatch) || nameToMatch.includes(sName))) {
          return true;
        }
        return false;
      };

      // 1. Map all registered chapter members (present or absent)
      const loadedMembers: Participant[] = Array.from(userMap.values()).map((m) => {
        const matchedSpeaker = speakers.find((s) => isSpeakerMatch(s, m.name, m.id));
        const isPresent = Boolean(matchedSpeaker);

        if (matchedSpeaker) {
          matchedSpeakerIds.add(matchedSpeaker.id);
        }

        return {
          id: m.id,
          name: m.name,
          avatar: m.avatar || (matchedSpeaker ? matchedSpeaker.photoURL || matchedSpeaker.coverImage : undefined),
          department: m.department,
          role: m.role,
          selected: true,
          type: isPresent ? "member_present" : "member_absent",
          checkedInAt: matchedSpeaker?.checkedInAt,
        };
      });

      // 2. Identify guests / attendees from the meeting (speakers not matching chapter members)
      const guestSpeakers: Participant[] = speakers
        .filter((s) => !matchedSpeakerIds.has(s.id))
        .map((s) => ({
          id: `guest-speaker-${s.id}`,
          name: s.name.trim(),
          avatar: s.photoURL || s.coverImage,
          department: (s as any).company || (s as any).slideProfile?.company || "Khách tham dự",
          role: "Khách mời",
          selected: true,
          type: "guest" as const,
          checkedInAt: s.checkedInAt,
        }));

      setParticipants([...loadedMembers, ...guestSpeakers]);
    } catch (err) {
      console.error("Lỗi khi tải danh sách người dùng cho vòng quay:", err);
      setParticipants([]);
    } finally {
      setLoadingUsers(false);
    }
  }, [userProfile]);

  useEffect(() => {
    if (!authLoading) {
      loadSystemUsers();
    }
  }, [authLoading, loadSystemUsers]);

  // 2. Fullscreen Toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // Keyboard Shortcuts: Space to spin, F for fullscreen, Esc to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        if (!isSpinning && !winnerModal && activeParticipants.length > 0) {
          handleStartSpin();
        }
      } else if (e.code === "KeyF") {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.code === "Escape") {
        if (winnerModal) {
          setWinnerModal(null);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSpinning, winnerModal, activeParticipants.length]);

  // Synchronize Bingo balls with active participants
  useEffect(() => {
    if (selectedGame === "bingo") {
      const canvas = canvasRef.current;
      const size = canvas ? canvas.width / (window.devicePixelRatio || 1) : 500;
      const cageRadius = size * 0.28;
      bingoBallsRef.current = initBingoBalls(activeParticipants, cageRadius);
      winningBallDropRef.current = null;
    }
  }, [activeParticipants, selectedGame]);

  // Render 3D Bingo Tumbler Cage with Wire Mesh, Physics & Rolling Balls
  const drawBingoContent = useCallback((ctx: CanvasRenderingContext2D, size: number) => {
    const cx = size / 2;
    const cy = size * 0.40;
    const cageRadius = size * 0.28;
    const angle = cageAngleRef.current;

    // 1. Heavy Wooden Plinth Base with Brass Inlay
    const baseY = size * 0.80;
    const baseW = size * 0.72;
    const baseH = size * 0.10;
    const baseLeft = cx - baseW / 2;

    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.18)";
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 10;

    // Walnut wood gradient
    const woodGrad = ctx.createLinearGradient(baseLeft, baseY, baseLeft, baseY + baseH);
    woodGrad.addColorStop(0, "#451a03");
    woodGrad.addColorStop(0.3, "#78350f");
    woodGrad.addColorStop(0.7, "#451a03");
    woodGrad.addColorStop(1, "#270f03");

    ctx.fillStyle = woodGrad;
    drawCanvasRoundRect(ctx, baseLeft, baseY, baseW, baseH, 14);
    ctx.fill();

    // Polished gold top trim on base
    const goldTrim = ctx.createLinearGradient(baseLeft, baseY, baseLeft + baseW, baseY);
    goldTrim.addColorStop(0, "#d97706");
    goldTrim.addColorStop(0.5, "#fef08a");
    goldTrim.addColorStop(1, "#d97706");
    ctx.fillStyle = goldTrim;
    ctx.fillRect(baseLeft + 6, baseY, baseW - 12, 3);

    // Plaque in the center
    const plaqueW = Math.min(220, baseW * 0.55);
    const plaqueH = 24;
    const plaqueLeft = cx - plaqueW / 2;
    const plaqueTop = baseY + baseH * 0.32;
    ctx.fillStyle = "#1e293b";
    drawCanvasRoundRect(ctx, plaqueLeft, plaqueTop, plaqueW, plaqueH, 6);
    ctx.fill();
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = "#fef08a";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("LỒNG CẦU BINGO • QUAY XỔ SỐ", cx, plaqueTop + plaqueH / 2);
    ctx.restore();

    // 2. Brass A-Frame Upright Supports (Left & Right)
    const drawUpright = (isLeft: boolean) => {
      const sign = isLeft ? -1 : 1;
      const topX = cx + sign * (cageRadius + 14);
      const topY = cy;
      const botX = cx + sign * (cageRadius + 44);
      const botY = baseY;

      ctx.save();
      const uprightGrad = ctx.createLinearGradient(topX, topY, botX, botY);
      uprightGrad.addColorStop(0, "#fde047");
      uprightGrad.addColorStop(0.5, "#b45309");
      uprightGrad.addColorStop(1, "#d97706");
      ctx.strokeStyle = uprightGrad;
      ctx.lineWidth = 10;
      ctx.lineCap = "round";

      ctx.beginPath();
      ctx.moveTo(topX, topY);
      ctx.lineTo(botX, botY);
      ctx.stroke();

      // Secondary leg for A-frame
      ctx.beginPath();
      ctx.moveTo(topX, topY);
      ctx.lineTo(botX - sign * 26, botY);
      ctx.lineWidth = 7;
      ctx.stroke();

      // Mechanical pivot bolt / bearing
      ctx.beginPath();
      ctx.arc(topX, topY, 12, 0, 2 * Math.PI);
      ctx.fillStyle = "#92400e";
      ctx.fill();
      ctx.strokeStyle = "#fef08a";
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
    };

    drawUpright(true);
    drawUpright(false);

    // 3. Crank Handle on Right
    const crankX = cx + cageRadius + 22;
    const crankY = cy;
    const crankLen = 30;
    const crankAngle = angle * 1.5;
    const knobX = crankX + Math.cos(crankAngle) * crankLen;
    const knobY = crankY + Math.sin(crankAngle) * crankLen;

    ctx.save();
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(crankX, crankY);
    ctx.lineTo(knobX, knobY);
    ctx.stroke();

    // Wooden Red Knob
    ctx.beginPath();
    ctx.arc(knobX, knobY, 8, 0, 2 * Math.PI);
    ctx.fillStyle = "#cf142b";
    ctx.fill();
    ctx.strokeStyle = "#fef08a";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // 4. Chute position references (used by winning ball drop animation)
    const chuteStartY = cy + cageRadius - 4;
    const chuteEndY = size * 0.74;

    // Empty state check
    if (activeParticipants.length === 0) {
      ctx.save();
      ctx.fillStyle = "#991b1b";
      ctx.font = "bold 15px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Vui lòng chọn hoặc thêm thành viên để quay số", cx, cy);
      ctx.restore();
      return;
    }

    // 5. BACK WIRES OF SPHERICAL CAGE (Drawn BEFORE balls)
    ctx.save();
    const ribCount = 14;
    for (let i = 0; i < ribCount; i++) {
      const ribAngle = angle + (i * Math.PI * 2) / ribCount;
      const cosA = Math.cos(ribAngle);
      if (cosA < 0) {
        ctx.beginPath();
        const radiusX = Math.abs(cosA) * cageRadius;
        ctx.ellipse(cx, cy, radiusX, cageRadius, 0, 0, 2 * Math.PI);
        ctx.strokeStyle = "rgba(180, 83, 9, 0.28)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // Back latitude wire rings
    const latRatios = [-0.65, -0.35, 0, 0.35, 0.65];
    for (const ratio of latRatios) {
      const latY = cy + cageRadius * ratio;
      const latRx = cageRadius * Math.sqrt(Math.max(0, 1 - ratio * ratio));
      ctx.beginPath();
      ctx.ellipse(cx, latY, latRx, latRx * 0.28, 0, 0, 2 * Math.PI);
      ctx.strokeStyle = "rgba(180, 83, 9, 0.25)";
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    // Central horizontal axle bar through the sphere
    const axleGrad = ctx.createLinearGradient(cx - cageRadius, cy, cx + cageRadius, cy);
    axleGrad.addColorStop(0, "#92400e");
    axleGrad.addColorStop(0.5, "#fde047");
    axleGrad.addColorStop(1, "#92400e");
    ctx.strokeStyle = axleGrad;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(cx - cageRadius - 4, cy);
    ctx.lineTo(cx + cageRadius + 4, cy);
    ctx.stroke();
    ctx.restore();

    // 6. TUMBLING LOTTERY BALLS INSIDE THE CAGE
    if (bingoBallsRef.current.length === 0 && activeParticipants.length > 0) {
      bingoBallsRef.current = initBingoBalls(activeParticipants, cageRadius);
    }

    for (let i = 0; i < bingoBallsRef.current.length; i++) {
      const b = bingoBallsRef.current[i];
      if (!b) continue;
      if (winningBallDropRef.current && winningBallDropRef.current.ball.ballNumber === b.ballNumber) {
        continue;
      }

      const bx = isFinite(b.x) ? cx + b.x : cx;
      const by = isFinite(b.y) ? cy + b.y : cy;
      const r = Math.max(10, isFinite(b.radius) && b.radius > 0 ? b.radius : 18);
      const palIdx = Math.abs(b.colorIdx || 0) % LOTTERY_BALL_PALETTE.length;
      const pal = LOTTERY_BALL_PALETTE[palIdx] || LOTTERY_BALL_PALETTE[0];

      ctx.save();
      const ballGrad = ctx.createRadialGradient(
        bx - r * 0.35,
        by - r * 0.35,
        Math.max(1, r * 0.1),
        bx,
        by,
        r
      );
      ballGrad.addColorStop(0, pal.start);
      ballGrad.addColorStop(0.4, pal.mid);
      ballGrad.addColorStop(1, pal.end);

      ctx.fillStyle = ballGrad;
      ctx.beginPath();
      ctx.arc(bx, by, r, 0, 2 * Math.PI);
      ctx.fill();

      // Circular white number plate
      const plateR = r * 0.52;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(bx, by, plateR, 0, 2 * Math.PI);
      ctx.fill();

      ctx.fillStyle = "#0f172a";
      ctx.font = `bold ${Math.round(r * 0.72)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(b.ballNumber), bx, by);

      // Specular highlight sheen
      ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
      ctx.beginPath();
      ctx.arc(bx - r * 0.35, by - r * 0.35, Math.max(1, r * 0.22), 0, 2 * Math.PI);
      ctx.fill();
      ctx.restore();
    }

    // 7. FRONT WIRES OF SPHERICAL CAGE (Drawn AFTER balls for 3D depth)
    ctx.save();
    for (let i = 0; i < ribCount; i++) {
      const ribAngle = angle + (i * Math.PI * 2) / ribCount;
      const cosA = Math.cos(ribAngle);
      if (cosA >= 0) {
        ctx.beginPath();
        const radiusX = Math.abs(cosA) * cageRadius;
        ctx.ellipse(cx, cy, radiusX, cageRadius, 0, 0, 2 * Math.PI);

        const ribGrad = ctx.createLinearGradient(cx - radiusX, cy - cageRadius, cx + radiusX, cy + cageRadius);
        ribGrad.addColorStop(0, "#fde047");
        ribGrad.addColorStop(0.5, "#d97706");
        ribGrad.addColorStop(1, "#b45309");

        ctx.strokeStyle = ribGrad;
        ctx.lineWidth = 2.2;
        ctx.stroke();
      }
    }

    // Front latitude wire rings
    for (const ratio of latRatios) {
      const latY = cy + cageRadius * ratio;
      const latRx = cageRadius * Math.sqrt(Math.max(0, 1 - ratio * ratio));
      ctx.beginPath();
      ctx.ellipse(cx, latY, latRx, latRx * 0.28, 0, 0, 2 * Math.PI);
      ctx.strokeStyle = "rgba(251, 191, 36, 0.45)";
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }

    // Main Outer Equator Rim Ring
    const outerRim = ctx.createLinearGradient(cx - cageRadius, cy - cageRadius, cx + cageRadius, cy + cageRadius);
    outerRim.addColorStop(0, "#fef08a");
    outerRim.addColorStop(0.3, "#f59e0b");
    outerRim.addColorStop(0.7, "#b45309");
    outerRim.addColorStop(1, "#fef08a");
    ctx.strokeStyle = outerRim;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(cx, cy, cageRadius, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.restore();

    // 8. WINNING BALL DROPPING DOWN THE CHUTE
    if (winningBallDropRef.current && winningBallDropRef.current.ball) {
      const { ball, progress } = winningBallDropRef.current;
      const startY = chuteStartY;
      const targetY = chuteEndY - 4;
      const safeProg = Math.max(0, Math.min(1, progress));
      const curY = startY + (targetY - startY) * safeProg;
      const curX = cx;
      const r = Math.max(12, (ball.radius || 18) * 1.15);
      const palIdx = Math.abs(ball.colorIdx || 0) % LOTTERY_BALL_PALETTE.length;
      const pal = LOTTERY_BALL_PALETTE[palIdx] || LOTTERY_BALL_PALETTE[0];

      ctx.save();
      if (safeProg > 0.8) {
        ctx.shadowColor = "#f59e0b";
        ctx.shadowBlur = 24;
      }

      const ballGrad = ctx.createRadialGradient(
        curX - r * 0.35,
        curY - r * 0.35,
        Math.max(1, r * 0.1),
        curX,
        curY,
        r
      );
      ballGrad.addColorStop(0, pal.start);
      ballGrad.addColorStop(0.4, pal.mid);
      ballGrad.addColorStop(1, pal.end);
      ctx.fillStyle = ballGrad;
      ctx.beginPath();
      ctx.arc(curX, curY, r, 0, 2 * Math.PI);
      ctx.fill();

      // Number plate
      const plateR = r * 0.52;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(curX, curY, plateR, 0, 2 * Math.PI);
      ctx.fill();

      ctx.fillStyle = "#0f172a";
      ctx.font = `bold ${Math.round(r * 0.72)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(ball.ballNumber), curX, curY);

      // Specular highlight
      ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
      ctx.beginPath();
      ctx.arc(curX - r * 0.35, curY - r * 0.35, Math.max(1, r * 0.22), 0, 2 * Math.PI);
      ctx.fill();
      ctx.restore();
    }
  }, [activeParticipants]);

  // 3. Render Wheel onto Canvas with High-End Game Show Visuals
  const drawWheel = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Retina DPI scale
    const dpr = window.devicePixelRatio || 1;

    // Calculate available dimensions in parent stage container precisely
    const stage = canvas.parentElement?.parentElement;
    const stageWidth = stage ? stage.clientWidth - 32 : window.innerWidth - (isDrawerOpen ? 384 : 0) - 32;
    const stageHeight = stage ? stage.clientHeight - 32 : window.innerHeight - 80;
    const size = Math.max(260, Math.floor(Math.min(stageWidth, stageHeight, 880)));
    if (size <= 0) return;

    // Set matching CSS display size in pixels to prevent ANY non-square distortion
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, size, size);

    if (selectedGame === "bingo") {
      drawBingoContent(ctx, size);
      return;
    }

    const cx = size / 2;
    const cy = size / 2;
    const rimWidth = Math.max(20, Math.round(size * 0.038));
    const radius = size / 2 - rimWidth - 14;
    const outerBezelRadius = radius + rimWidth;

    const slices = getDisplaySlices(activeParticipants);
    const sliceCount = slices.length;

    if (sliceCount === 0) {
      // Empty state with luxury frame
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, outerBezelRadius, 0, 2 * Math.PI);
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "rgba(207, 20, 43, 0.15)";
      ctx.shadowBlur = 30;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
      ctx.fillStyle = "#fff5f5";
      ctx.strokeStyle = "#cf142b";
      ctx.lineWidth = 4;
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#991b1b";
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Vui lòng chọn hoặc thêm thành viên để quay", cx, cy);
      ctx.restore();
      return;
    }

    const arc = (2 * Math.PI) / sliceCount;
    const currentAngle = currentAngleRef.current;

    // ==========================================
    // 1. GRAND 3D METALLIC BEZEL & MARQUEE LIGHTS
    // ==========================================

    // Outer Stage Drop Shadow
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, outerBezelRadius + 2, 0, 2 * Math.PI);
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.shadowColor = "rgba(180, 20, 40, 0.22)";
    ctx.shadowBlur = 36;
    ctx.shadowOffsetY = 10;
    ctx.fill();
    ctx.restore();

    // Stepped Gold & Titanium Outer Ring
    ctx.save();
    const bezelGrad = ctx.createLinearGradient(
      cx - outerBezelRadius,
      cy - outerBezelRadius,
      cx + outerBezelRadius,
      cy + outerBezelRadius
    );
    bezelGrad.addColorStop(0, "#fef08a");
    bezelGrad.addColorStop(0.2, "#d97706");
    bezelGrad.addColorStop(0.4, "#78350f");
    bezelGrad.addColorStop(0.6, "#fef08a");
    bezelGrad.addColorStop(0.8, "#b45309");
    bezelGrad.addColorStop(1, "#f59e0b");

    ctx.beginPath();
    ctx.arc(cx, cy, outerBezelRadius, 0, 2 * Math.PI);
    ctx.fillStyle = bezelGrad;
    ctx.fill();

    // Recessed Dark Marquee Channel for Bulbs
    ctx.beginPath();
    ctx.arc(cx, cy, outerBezelRadius - 4, 0, 2 * Math.PI);
    ctx.fillStyle = "#1e0b10";
    ctx.fill();

    // Inner Gold Track Border
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 3, 0, 2 * Math.PI);
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // 28 Dynamic Chasing Marquee LED Bulbs
    const bulbCount = 28;
    const bulbRadiusTrack = radius + rimWidth / 2 - 2;
    const currentPhase = lightPhaseRef.current;

    for (let b = 0; b < bulbCount; b++) {
      const bulbAngle = (b * (2 * Math.PI)) / bulbCount;
      const bx = cx + bulbRadiusTrack * Math.cos(bulbAngle);
      const by = cy + bulbRadiusTrack * Math.sin(bulbAngle);

      // 4-phase chasing pattern
      const offset = (b - Math.floor(currentPhase)) % 4;
      const isLit = offset === 0 || offset === -3 || (offset < 0 && offset + 4 === 0);

      ctx.save();
      ctx.beginPath();
      ctx.arc(bx, by, 4.5, 0, 2 * Math.PI);

      if (isLit) {
        // Glowing cabochon light
        ctx.fillStyle = "#ffffff";
        ctx.shadowColor = "#fde047";
        ctx.shadowBlur = 12;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(bx, by, 2.5, 0, 2 * Math.PI);
        ctx.fillStyle = "#fef08a";
        ctx.fill();
      } else {
        // Warm amber jewel
        ctx.fillStyle = "#92400e";
        ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
        ctx.shadowBlur = 2;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(bx - 1, by - 1, 1.2, 0, 2 * Math.PI);
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        ctx.fill();
      }
      ctx.restore();
    }

    // ==========================================
    // 2. LUXURY WEDGES WITH 3D DEPTH & LABELS
    // ==========================================
    const hubRadius = Math.max(46, radius * 0.185);

    for (let i = 0; i < sliceCount; i++) {
      const slice = slices[i];
      const sliceAngle = currentAngle + i * arc;
      const palette = LUXURY_PALETTE[slice.paletteIndex % LUXURY_PALETTE.length];

      ctx.save();
      ctx.beginPath();
      if (sliceCount === 1) {
        ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
      } else {
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, sliceAngle, sliceAngle + arc);
        ctx.closePath();
      }

      // Radial 3D depth gradient on each wedge
      const wedgeGrad = ctx.createRadialGradient(cx, cy, hubRadius * 0.9, cx, cy, radius);
      wedgeGrad.addColorStop(0, palette.end);
      wedgeGrad.addColorStop(0.35, palette.mid);
      wedgeGrad.addColorStop(0.85, palette.start);
      wedgeGrad.addColorStop(1, palette.mid);
      ctx.fillStyle = wedgeGrad;
      ctx.fill();

      // Only draw divider line & perimeter rivet if there are 2 or more slices
      if (sliceCount > 1) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
        ctx.lineWidth = sliceCount > 24 ? 1 : 2;
        ctx.stroke();

        // Perimeter Golden Rivet on Divider Ray
        const rivetAngle = sliceAngle;
        const rx = cx + (radius - 8) * Math.cos(rivetAngle);
        const ry = cy + (radius - 8) * Math.sin(rivetAngle);
        ctx.beginPath();
        ctx.arc(rx, ry, 2.5, 0, 2 * Math.PI);
        ctx.fillStyle = "#fef08a";
        ctx.shadowColor = "#000000";
        ctx.shadowBlur = 3;
        ctx.fill();
      } else {
        // Decorative inner gold ring when only 1 participant
        ctx.beginPath();
        ctx.arc(cx, cy, radius - 8, 0, 2 * Math.PI);
        ctx.strokeStyle = "rgba(254, 240, 138, 0.5)";
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      // Text along Radial Ray
      ctx.save();
      ctx.translate(cx, cy);

      if (sliceCount === 1) {
        // When there is only 1 person, render cleanly in the upper hemisphere rotating with the wheel
        ctx.rotate(currentAngle);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "900 24px sans-serif";
        ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 2;
        ctx.fillStyle = palette.text;
        ctx.fillText(slice.displayName, 0, -(radius * 0.48));
      } else {
        ctx.rotate(sliceAngle + arc / 2);

        let fontSize = 18;
        if (sliceCount > 40) fontSize = 10;
        else if (sliceCount > 28) fontSize = 12;
        else if (sliceCount > 18) fontSize = 14;
        else if (sliceCount > 10) fontSize = 16;
        else fontSize = 18;

        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";

        // 3D Text Shadow
        ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
        ctx.shadowBlur = 5;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        ctx.fillStyle = palette.text;

        let nameText = slice.displayName;
        const maxChars = sliceCount > 30 ? 12 : sliceCount > 18 ? 16 : 24;
        if (nameText.length > maxChars) {
          nameText = nameText.slice(0, maxChars - 1) + "…";
        }

        ctx.fillText(nameText, radius - 26, 0);

        // Mini circle bullet near border
        ctx.beginPath();
        ctx.arc(radius - 12, 0, 3, 0, 2 * Math.PI);
        ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
        ctx.shadowColor = palette.start;
        ctx.shadowBlur = 6;
        ctx.fill();
      }

      ctx.restore();
      ctx.restore();
    }

    // ==========================================
    // 3. DIAGONAL GLASS LENS SHEEN OVER WHEEL
    // ==========================================
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
    const lensGrad = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
    lensGrad.addColorStop(0, "rgba(255, 255, 255, 0.12)");
    lensGrad.addColorStop(0.45, "rgba(255, 255, 255, 0.03)");
    lensGrad.addColorStop(0.5, "rgba(0, 0, 0, 0)");
    lensGrad.addColorStop(1, "rgba(0, 0, 0, 0.18)");
    ctx.fillStyle = lensGrad;
    ctx.fill();
    ctx.restore();

    // ==========================================
    // 4. 3D MASTER CENTER "QUAY" BUTTON
    // ==========================================

    // Center Breathing Aura Pulse (when idle & ready)
    if (!isSpinning && sliceCount > 0) {
      const pulseScale = 1 + 0.07 * Math.sin(pulseAnimRef.current);
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, hubRadius * pulseScale + 10, 0, 2 * Math.PI);
      const auraGrad = ctx.createRadialGradient(cx, cy, hubRadius, cx, cy, hubRadius * pulseScale + 10);
      auraGrad.addColorStop(0, "rgba(251, 191, 36, 0.45)");
      auraGrad.addColorStop(1, "rgba(251, 191, 36, 0)");
      ctx.fillStyle = auraGrad;
      ctx.fill();
      ctx.restore();
    }

    // Hub Outer Deep Drop Shadow
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, hubRadius + 8, 0, 2 * Math.PI);
    ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
    ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 4;
    ctx.fill();
    ctx.restore();

    // Gold Stepped Chamfer Ring
    ctx.save();
    const goldRingGrad = ctx.createLinearGradient(
      cx - hubRadius,
      cy - hubRadius,
      cx + hubRadius,
      cy + hubRadius
    );
    goldRingGrad.addColorStop(0, "#fef08a");
    goldRingGrad.addColorStop(0.25, "#f59e0b");
    goldRingGrad.addColorStop(0.5, "#78350f");
    goldRingGrad.addColorStop(0.75, "#fbbf24");
    goldRingGrad.addColorStop(1, "#fef08a");

    ctx.beginPath();
    ctx.arc(cx, cy, hubRadius + 6, 0, 2 * Math.PI);
    ctx.fillStyle = goldRingGrad;
    ctx.fill();

    // Dark Inset Groove
    ctx.beginPath();
    ctx.arc(cx, cy, hubRadius + 1.5, 0, 2 * Math.PI);
    ctx.fillStyle = "#450a0a";
    ctx.fill();

    // Master Button Face Radial Sunburst Gradient
    const hubGrad = ctx.createRadialGradient(
      cx - hubRadius * 0.25,
      cy - hubRadius * 0.25,
      2,
      cx,
      cy,
      hubRadius
    );
    hubGrad.addColorStop(0, "#fee2e2");
    hubGrad.addColorStop(0.2, "#f87171");
    hubGrad.addColorStop(0.55, "#cf142b");
    hubGrad.addColorStop(0.85, "#991b1b");
    hubGrad.addColorStop(1, "#5f0f18");

    ctx.beginPath();
    ctx.arc(cx, cy, hubRadius, 0, 2 * Math.PI);
    ctx.fillStyle = hubGrad;
    ctx.fill();

    // Convex Glass Gloss Highlight Arc
    ctx.beginPath();
    ctx.ellipse(cx, cy - hubRadius * 0.35, hubRadius * 0.72, hubRadius * 0.38, 0, 0, 2 * Math.PI);
    const glassGrad = ctx.createLinearGradient(cx, cy - hubRadius * 0.7, cx, cy);
    glassGrad.addColorStop(0, "rgba(255, 255, 255, 0.7)");
    glassGrad.addColorStop(0.6, "rgba(255, 255, 255, 0.15)");
    glassGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = glassGrad;
    ctx.fill();

    // Crisp Inner Highlight Stroke
    ctx.beginPath();
    ctx.arc(cx, cy, hubRadius - 1.5, 0, 2 * Math.PI);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Embossed 3D "QUAY" Typography
    ctx.shadowColor = "#451a03";
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = "#ffffff";
    const hubFontSize = Math.max(16, Math.round(hubRadius * 0.46));
    ctx.font = `900 ${hubFontSize}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("QUAY", cx, cy + 1);
    ctx.restore();

    // ==========================================
    // 5. 3D POINTER NEEDLE AT 3 O'CLOCK
    // ==========================================
    ctx.save();
    ctx.translate(cx + radius + 12, cy);
    ctx.rotate(pointerBounceRef.current);

    // Drop Shadow for Needle
    ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
    ctx.shadowBlur = 14;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 4;

    // Outer Golden Arrow Body
    ctx.beginPath();
    ctx.moveTo(-32, 0); // Apex pointing into wheel
    ctx.lineTo(20, -18);
    ctx.lineTo(14, 0);
    ctx.lineTo(20, 18);
    ctx.closePath();
    ctx.fillStyle = "#fbbf24";
    ctx.fill();

    // Inner Ruby Crystal Core
    ctx.beginPath();
    ctx.moveTo(-28, 0);
    ctx.lineTo(17, -14);
    ctx.lineTo(12, 0);
    ctx.lineTo(17, 14);
    ctx.closePath();
    const rubyGrad = ctx.createLinearGradient(-28, 0, 17, 0);
    rubyGrad.addColorStop(0, "#ef4444");
    rubyGrad.addColorStop(0.5, "#dc2626");
    rubyGrad.addColorStop(1, "#7f1d1d");
    ctx.fillStyle = rubyGrad;
    ctx.fill();

    // Specular Highlight Streak
    ctx.beginPath();
    ctx.moveTo(-26, 0);
    ctx.lineTo(15, -12);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Metallic Pivot Cap / Bolt
    ctx.beginPath();
    ctx.arc(8, 0, 7, 0, 2 * Math.PI);
    const boltGrad = ctx.createRadialGradient(6, -2, 1, 8, 0, 7);
    boltGrad.addColorStop(0, "#ffffff");
    boltGrad.addColorStop(0.4, "#fef08a");
    boltGrad.addColorStop(1, "#78350f");
    ctx.fillStyle = boltGrad;
    ctx.shadowBlur = 4;
    ctx.fill();
    ctx.strokeStyle = "#451a03";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
  }, [activeParticipants, isSpinning, isDrawerOpen, selectedGame, drawBingoContent]);

  // Keep wheel rendered on state changes
  useEffect(() => {
    drawWheel();
  }, [drawWheel]);

  // Idle animation for chasing marquee lights & glowing center button or rotating bingo cage
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      if (!isSpinning && !document.hidden) {
        const delta = time - lastTime;
        if (delta >= 40) {
          lastTime = time;
          if (selectedGame === "wheel") {
            lightPhaseRef.current = (lightPhaseRef.current + 0.1) % 28;
            pulseAnimRef.current = (pulseAnimRef.current + 0.06) % (2 * Math.PI);
            drawWheel();
          } else {
            cageAngleRef.current = (cageAngleRef.current + 0.003) % (2 * Math.PI);
            drawWheel();
          }
        }
      }
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isSpinning, drawWheel, selectedGame]);

  // Resize handler for responsive canvas
  useEffect(() => {
    const handleResize = () => {
      drawWheel();
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [drawWheel]);

  // Redraw when drawer toggles to adjust available size smoothly
  useEffect(() => {
    drawWheel();
    const timer = setTimeout(drawWheel, 320);
    return () => clearTimeout(timer);
  }, [isDrawerOpen, drawWheel]);

  // 4A. Wheel Spin Mechanics
  const handleStartSpinWheel = () => {
    if (isSpinning || activeParticipants.length === 0) return;

    setIsSpinning(true);
    if (soundEnabled) {
      playSuspenseSound();
    }

    const slices = getDisplaySlices(activeParticipants);
    const count = slices.length;
    if (count === 0) return;
    const arc = (2 * Math.PI) / count;

    // Pick random winning index
    const winningIndex = Math.floor(Math.random() * count);
    const winner = slices[winningIndex].participant;

    const currentAngle = currentAngleRef.current % (2 * Math.PI);
    const targetSliceCenter = 2 * Math.PI - (winningIndex * arc + arc / 2);

    const extraRotations = 6 + Math.floor(Math.random() * 3);
    const totalAngleDelta =
      extraRotations * 2 * Math.PI +
      (targetSliceCenter - currentAngle) +
      (currentAngle > targetSliceCenter ? 2 * Math.PI : 0);

    const startTime = performance.now();
    const durationMs = spinDuration * 1000;
    const startAngle = currentAngleRef.current;

    const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);
    lastTickIndexRef.current = -1;

    const animateSpin = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);

      const easedProgress = easeOutQuart(progress);
      currentAngleRef.current = startAngle + totalAngleDelta * easedProgress;

      lightPhaseRef.current = (lightPhaseRef.current + (1 - progress * 0.6) * 1.4) % 28;

      const normalizedAngle = (2 * Math.PI - (currentAngleRef.current % (2 * Math.PI))) % (2 * Math.PI);
      const currentPassingSlice = Math.floor(normalizedAngle / arc);

      if (currentPassingSlice !== lastTickIndexRef.current) {
        lastTickIndexRef.current = currentPassingSlice;
        if (soundEnabled) {
          const speedFactor = 1 - progress;
          playTickSound(650 + speedFactor * 300);
        }
        pointerBounceRef.current = -0.32;
      } else {
        pointerBounceRef.current *= 0.82;
      }

      drawWheel();

      if (progress < 1) {
        animationFrameIdRef.current = requestAnimationFrame(animateSpin);
      } else {
        pointerBounceRef.current = 0;
        drawWheel();
        setIsSpinning(false);

        const record: WinnerRecord = {
          id: crypto.randomUUID(),
          name: winner.name,
          prizeName: currentPrize,
          avatar: winner.avatar,
          department: winner.department,
          wonAt: new Date().toISOString(),
        };

        record.source = "wheel";
        setWinners((prev) => [record, ...prev]);
        persistWinner(record, winner, "wheel");

        if (soundEnabled) {
          playWinFanfare();
        }
        launchConfetti(4500);

        setWinnerModal({
          winner,
          prize: currentPrize,
        });
      }
    };

    animationFrameIdRef.current = requestAnimationFrame(animateSpin);
  };

  // 4B. Bingo Cage Spin Mechanics with 3D Tumbling & Dropping Ball
  const handleStartSpinBingo = () => {
    if (isSpinning || activeParticipants.length === 0) return;
    setIsSpinning(true);
    winningBallDropRef.current = null;
    if (soundEnabled) {
      playSuspenseSound();
    }

    const winningIndex = Math.floor(Math.random() * activeParticipants.length);
    const winningParticipant = activeParticipants[winningIndex];
    const winningBallNumber = winningIndex + 1;

    const startTime = performance.now();
    const durationMs = spinDuration * 1000;
    const tumbleDurationMs = Math.max(2500, durationMs - 1400);
    let lastAudioTick = 0;

    const canvas = canvasRef.current;
    const size = canvas ? canvas.width / (window.devicePixelRatio || 1) : 500;
    const cageRadius = size * 0.28;

    if (bingoBallsRef.current.length === 0) {
      bingoBallsRef.current = initBingoBalls(activeParticipants, cageRadius);
    }

    const animateBingo = (now: number) => {
      try {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / durationMs);

        if (elapsed < tumbleDurationMs) {
          // Tumbling phase
          const tumbleProgress = elapsed / tumbleDurationMs;
          const speed = Math.max(0.04, (1 - Math.pow(tumbleProgress, 2.5)) * 0.35);

          cageAngleRef.current = (cageAngleRef.current + speed) % (2 * Math.PI);

          if (soundEnabled && now - lastAudioTick > 65) {
            lastAudioTick = now;
            playTickSound(350 + Math.random() * 450);
          }

          const balls = bingoBallsRef.current;
          const maxR = Math.max(30, cageRadius - (balls[0]?.radius || 18) - 4);

          for (let i = 0; i < balls.length; i++) {
            const b = balls[i];
            b.vx += (Math.random() - 0.5) * speed * 20 + Math.cos(cageAngleRef.current) * speed * 6;
            b.vy += -speed * 14 + (Math.random() - 0.5) * speed * 16 + 0.35;
            b.rotation += (Math.random() - 0.5) * 0.25;

            b.vx *= 0.94;
            b.vy *= 0.94;

            b.x += b.vx;
            b.y += b.vy;

            // Constrain physics safely to prevent explosive NaN
            const d = Math.hypot(b.x, b.y);
            if (d > maxR && d > 0.0001) {
              const nx = b.x / d;
              const ny = b.y / d;
              b.x = nx * maxR;
              b.y = ny * maxR;
              const dot = b.vx * nx + b.vy * ny;
              if (dot > 0) {
                // Outward velocity: reflect inwards with 0.6 restitution damping
                b.vx -= 1.6 * dot * nx;
                b.vy -= 1.6 * dot * ny;
              }
            } else if (!isFinite(b.x) || !isFinite(b.y)) {
              b.x = (Math.random() - 0.5) * maxR * 0.5;
              b.y = (Math.random() - 0.5) * maxR * 0.5;
              b.vx = 0;
              b.vy = 0;
            }

            // Clamp max velocity
            const vSpeed = Math.hypot(b.vx, b.vy);
            if (vSpeed > 14) {
              b.vx = (b.vx / vSpeed) * 14;
              b.vy = (b.vy / vSpeed) * 14;
            }
          }
        } else {
          // Drop phase: winning ball rolls down chute
          const dropElapsed = elapsed - tumbleDurationMs;
          const dropProgress = Math.min(1, dropElapsed / 1400);

          cageAngleRef.current = (cageAngleRef.current + Math.max(0, 0.04 * (1 - dropProgress))) % (2 * Math.PI);

          const balls = bingoBallsRef.current;
          const maxR = Math.max(30, cageRadius - (balls[0]?.radius || 18) - 4);
          for (let i = 0; i < balls.length; i++) {
            const b = balls[i];
            b.vy += 0.45;
            b.vx *= 0.88;
            b.vy *= 0.88;
            b.x += b.vx;
            b.y += b.vy;
            const d = Math.hypot(b.x, b.y);
            if (d > maxR && d > 0.0001) {
              b.x = (b.x / d) * maxR;
              b.y = (b.y / d) * maxR;
              b.vx = 0;
              b.vy = 0;
            } else if (!isFinite(b.x) || !isFinite(b.y)) {
              b.x = 0;
              b.y = maxR * 0.6;
              b.vx = 0;
              b.vy = 0;
            }
          }

          const winningBallObj = balls[winningIndex] || balls[0];
          if (winningBallObj) {
            winningBallDropRef.current = {
              ball: winningBallObj,
              progress: dropProgress,
            };
          }
        }

        drawWheel();

        if (progress < 1) {
          animationFrameIdRef.current = requestAnimationFrame(animateBingo);
        } else {
          setIsSpinning(false);

          const record: WinnerRecord = {
            id: crypto.randomUUID(),
            name: winningParticipant.name,
            prizeName: currentPrize,
            avatar: winningParticipant.avatar,
            department: winningParticipant.department,
            wonAt: new Date().toISOString(),
          };

          record.source = "bingo";
          setWinners((prev) => [record, ...prev]);
          persistWinner(record, winningParticipant, "bingo", winningBallNumber);

          if (soundEnabled) {
            playWinFanfare();
          }
          launchConfetti(4500);

          setWinnerModal({
            winner: winningParticipant,
            prize: currentPrize,
            ballNumber: winningBallNumber,
          });
        }
      } catch (err) {
        console.error("Bingo animation error:", err);
        setIsSpinning(false);
      }
    };

    animationFrameIdRef.current = requestAnimationFrame(animateBingo);
  };

  // Unified start spin action
  const handleStartSpin = () => {
    if (isSpinning || activeParticipants.length === 0) return;
    if (selectedGame === "wheel") {
      handleStartSpinWheel();
    } else {
      handleStartSpinBingo();
    }
  };

  // Remove winner from wheel (action in modal)
  const handleRemoveWinnerFromWheel = (winnerId: string) => {
    setParticipants((prev) => prev.map((p) => (p.id === winnerId ? { ...p, selected: false } : p)));
    setWinnerModal(null);
  };

  // Add custom guest
  const handleAddGuest = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newGuestName.trim();
    if (!trimmed) return;

    const newParticipant: Participant = {
      id: `guest-${Date.now()}`,
      name: trimmed,
      department: "Khách mời",
      role: "Khách tham dự",
      selected: true,
      isCustom: true,
      type: "guest",
    };
    setParticipants((prev) => [newParticipant, ...prev]);
    setNewGuestName("");
  };

  // Toggle presence for chapter member
  const handleTogglePresence = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSpinning) return;
    setParticipants((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        if (p.type === "guest") return p;
        const nextType: ParticipantType =
          p.type === "member_present" ? "member_absent" : "member_present";
        return { ...p, type: nextType };
      })
    );
  };

  // Shuffle active participants
  const handleShuffle = () => {
    if (isSpinning) return;
    setParticipants((prev) => {
      const arr = [...prev];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    });
  };

  // Select / Deselect all in CURRENT category
  const handleToggleSelectAll = (select: boolean) => {
    if (isSpinning) return;
    const currentCategoryIds = new Set(categoryParticipants.map((p) => p.id));
    setParticipants((prev) =>
      prev.map((p) => (currentCategoryIds.has(p.id) ? { ...p, selected: select } : p))
    );
  };

  // Toggle single participant
  const handleToggleParticipant = (id: string) => {
    if (isSpinning) return;
    setParticipants((prev) => prev.map((p) => (p.id === id ? { ...p, selected: !p.selected } : p)));
  };

  // Delete single participant
  const handleDeleteParticipant = (id: string) => {
    if (isSpinning) return;
    setParticipants((prev) => prev.filter((p) => p.id !== id));
  };

  // Export winners to CSV
  const handleExportWinners = () => {
    if (winners.length === 0) return;
    const header = "STT,Tên người trúng giải,Giải thưởng,Phòng ban / Vai trò,Thời gian trúng\n";
    const rows = winners
      .map(
        (w, idx) =>
          `${idx + 1},"${w.name}","${w.prizeName}","${w.department || ""}","${w.wonAt}"`
      )
      .join("\n");
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + encodeURIComponent(header + rows);
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", `Danh_Sach_Trung_Thuong_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered participants list for sidebar (category + search query)
  const filteredParticipants = categoryParticipants.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.department && p.department.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-gradient-to-br from-slate-100 via-[#fff9f9] to-[#fff4eb] font-sans text-slate-800 select-none">
      {unsavedResults.length > 0 && <div role="status" className="absolute top-20 left-4 z-50 rounded-xl bg-amber-100 p-3 text-sm text-amber-900 shadow">
        Có {unsavedResults.length} kết quả chưa lưu. Giữ trang mở cho đến khi lưu xong.
        <button className="ml-3 font-bold underline" onClick={() => unsavedResults.forEach(entry => void saveResult(entry))}>Thử lưu lại</button>
      </div>}
      {/* Background Ambient Glows & Celebration Rays */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-red-500/12 blur-[140px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[600px] w-[600px] rounded-full bg-amber-500/15 blur-[140px]" />
      <div className="pointer-events-none absolute top-1/2 left-1/3 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-yellow-400/15 blur-[160px]" />

      {/* Main Wheel Area */}
      <div className="flex flex-1 flex-col h-full overflow-hidden">
        {/* Top Header Bar */}
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/90 px-3 backdrop-blur-xl z-20">
          {/* Left: Back + Logo + Title + Game Switcher */}
          <div className="flex items-center gap-2">
            <a
              href="/"
              title="Quay lại"
              className="flex items-center p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
            </a>

            <img
              src={BRAND_LOGO_PATH}
              alt={BRAND_NAME}
              className="h-7 w-7 rounded-md border border-slate-200 object-cover"
            />

            <span className="text-sm font-semibold text-slate-800">Quay thưởng</span>

            <span className="rounded bg-[#cf142b] px-1.5 py-0.5 text-[9px] font-semibold text-white uppercase tracking-wide">
              {userProfile?.companyName || userProfile?.companyCode || "BNI"}
            </span>

            {/* Game Switcher */}
            <div className="hidden md:flex items-center rounded-lg bg-slate-100 p-0.5 ml-1">
              <button
                type="button"
                onClick={() => { if (!isSpinning) setSelectedGame("wheel"); }}
                disabled={isSpinning}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition cursor-pointer disabled:opacity-50 ${
                  selectedGame === "wheel"
                    ? "bg-white text-[#cf142b] shadow-xs"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Disc className="h-3 w-3" />
                Vòng quay
              </button>
              <button
                type="button"
                onClick={() => { if (!isSpinning) setSelectedGame("bingo"); }}
                disabled={isSpinning}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition cursor-pointer disabled:opacity-50 ${
                  selectedGame === "bingo"
                    ? "bg-white text-[#cf142b] shadow-xs"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Dices className="h-3 w-3" />
                Lồng cầu Bingo
              </button>
            </div>
          </div>

          {/* Center: Prize Display */}
          <div className="hidden lg:flex items-center">
            {isEditingPrize ? (
              <div className="flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 border border-amber-300 shadow-xs">
                <input
                  type="text"
                  value={prizeInput}
                  onChange={(e) => setPrizeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setCurrentPrize(prizeInput.trim() || "Giải Thưởng May Mắn");
                      setIsEditingPrize(false);
                    }
                  }}
                  autoFocus
                  className="bg-transparent text-xs text-amber-900 outline-none w-40 text-center"
                />
                <button
                  type="button"
                  onClick={() => {
                    setCurrentPrize(prizeInput.trim() || "Giải Thưởng May Mắn");
                    setIsEditingPrize(false);
                  }}
                  className="text-emerald-600 hover:text-emerald-700 p-0.5 cursor-pointer"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setPrizeInput(currentPrize);
                  setIsEditingPrize(true);
                }}
                className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] text-amber-800 transition hover:bg-amber-100 cursor-pointer"
              >
                <Trophy className="h-3.5 w-3.5 text-amber-500" />
                <span className="font-medium">{currentPrize}</span>
                <span className="text-[9px] text-amber-500">Đổi</span>
              </button>
            )}
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-1.5">
            {/* Spin Duration */}
            <div className="hidden sm:flex items-center rounded-lg bg-slate-100 p-0.5">
              <Clock className="h-3 w-3 text-slate-400 ml-1 mr-0.5" />
              {[5, 8, 12].map((dur) => (
                <button
                  key={dur}
                  type="button"
                  onClick={() => setSpinDuration(dur)}
                  disabled={isSpinning}
                  className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium transition cursor-pointer ${
                    spinDuration === dur
                      ? "bg-white text-[#cf142b] shadow-xs"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {dur}s
                </button>
              ))}
            </div>

            {/* Sound */}
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? "Tắt âm thanh" : "Bật âm thanh"}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 transition cursor-pointer"
            >
              {soundEnabled ? <Volume2 className="h-4 w-4 text-emerald-500" /> : <VolumeX className="h-4 w-4 text-slate-400" />}
            </button>

            {/* Fullscreen */}
            <button
              type="button"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Thu nhỏ (F)" : "Toàn màn hình (F)"}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 transition cursor-pointer"
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>

            {/* Drawer Toggle */}
            <button
              type="button"
              onClick={() => setIsDrawerOpen(!isDrawerOpen)}
              className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition cursor-pointer ${
                isDrawerOpen
                  ? "border-[#cf142b]/30 bg-red-50 text-[#cf142b]"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Thành viên ({activeParticipants.length})</span>
            </button>
          </div>
        </header>

        {/* Stage Content */}
        <div className="relative flex flex-1 h-full w-full items-center justify-center p-3 sm:p-6 overflow-hidden">
          {/* Ambient Stage Spotlight Glow */}
          <div
            className="pointer-events-none absolute h-[560px] w-[560px] rounded-full bg-gradient-to-tr from-red-500/15 via-amber-400/20 to-transparent blur-[120px] animate-pulse"
            style={{ animationDuration: "5s" }}
          />

          {/* Main Wheel / Bingo Canvas Container */}
          <div className="relative flex flex-col items-center justify-center max-h-full max-w-full drop-shadow-[0_16px_40px_rgba(207,20,43,0.18)]">
            <canvas
              ref={canvasRef}
              onClick={handleStartSpin}
              title={
                isSpinning
                  ? "Đang quay..."
                  : selectedGame === "wheel"
                  ? "Nhấn nút QUAY ở giữa để bắt đầu"
                  : "Nhấn để QUAY SỐ BINGO"
              }
              className={`select-none transition-transform duration-300 block ${
                isSpinning ? "cursor-not-allowed scale-[1.008]" : "cursor-pointer hover:scale-[1.012]"
              }`}
            />

            {/* Prominent Bingo Spin Button */}
            {selectedGame === "bingo" && (
              <div className="absolute -bottom-1 sm:bottom-2 left-1/2 -translate-x-1/2 z-10 pointer-events-auto">
                <button
                  type="button"
                  onClick={handleStartSpin}
                  disabled={isSpinning || activeParticipants.length === 0}
                  className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#cf142b] via-[#e11d48] to-[#cf142b] hover:from-[#b00f24] hover:to-[#990e1f] px-7 py-3 text-xs sm:text-sm font-black tracking-wide text-white shadow-xl shadow-red-700/30 border border-amber-300/40 hover:scale-105 active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Dices className={`h-4.5 w-4.5 ${isSpinning ? "animate-spin" : ""}`} />
                  <span>{isSpinning ? "ĐANG QUAY SỐ..." : "BẮT ĐẦU QUAY SỐ"}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Collapsible Participants & Winners Drawer */}
      <div
        className={`flex flex-col border-l border-slate-200/90 bg-white/95 backdrop-blur-2xl transition-all duration-300 z-30 shadow-xl ${
          isDrawerOpen ? "w-80 sm:w-96" : "w-0 opacity-0 overflow-hidden pointer-events-none"
        }`}
      >
        {/* Drawer Tabs */}
        <div className="flex items-center border-b border-slate-200 p-2 gap-1 bg-slate-50/70">
          <button
            type="button"
            onClick={() => setActiveDrawerTab("participants")}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-bold transition cursor-pointer ${
              activeDrawerTab === "participants"
                ? "bg-[#cf142b] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-white"
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Thành viên ({activeParticipants.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveDrawerTab("winners")}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-bold transition cursor-pointer ${
              activeDrawerTab === "winners"
                ? "bg-[#cf142b] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-white"
            }`}
          >
            <Trophy className="h-4 w-4" />
            <span>Trúng giải ({winners.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setIsDrawerOpen(false)}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg ml-0.5 cursor-pointer"
            title="Đóng bảng bên"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Tab 1: Participants List */}
        {activeDrawerTab === "participants" && (
          <div className="flex flex-1 flex-col overflow-hidden p-3.5 space-y-3 bg-white">
            {/* Quick Add Guest Form */}
            <form onSubmit={handleAddGuest} className="relative">
              <input
                type="text"
                placeholder="+ Thêm khách mời / người mới..."
                value={newGuestName}
                onChange={(e) => setNewGuestName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-[#cf142b] focus:bg-white focus:ring-1 focus:ring-[#cf142b]/30 shadow-2xs"
              />
              <button
                type="submit"
                disabled={!newGuestName.trim()}
                className="absolute right-1.5 top-1.5 rounded-lg bg-[#cf142b] p-1 text-white disabled:opacity-40 hover:bg-[#b00f24] transition cursor-pointer shadow-xs"
              >
                <UserPlus className="h-3.5 w-3.5" />
              </button>
            </form>

            {/* 4-Category Filter Bar */}
            <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100/90 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setFilterCategory("all")}
                disabled={isSpinning}
                title="Tất cả thành viên (cả vắng mặt) + Khách tham dự hôm nay"
                className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-lg text-center transition cursor-pointer disabled:opacity-50 ${
                  filterCategory === "all"
                    ? "bg-[#cf142b] text-white font-bold shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/80 font-medium"
                }`}
              >
                <span className="text-[11px] leading-tight">Tất cả</span>
                <span
                  className={`text-[10px] leading-tight mt-0.5 ${
                    filterCategory === "all" ? "text-amber-200 font-bold" : "text-slate-400"
                  }`}
                >
                  ({countAll})
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFilterCategory("all_members")}
                disabled={isSpinning}
                title="Tất cả thành viên Chapter (cả có mặt và vắng mặt)"
                className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-lg text-center transition cursor-pointer disabled:opacity-50 ${
                  filterCategory === "all_members"
                    ? "bg-[#cf142b] text-white font-bold shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/80 font-medium"
                }`}
              >
                <span className="text-[11px] leading-tight">Tất cả TV</span>
                <span
                  className={`text-[10px] leading-tight mt-0.5 ${
                    filterCategory === "all_members" ? "text-amber-200 font-bold" : "text-slate-400"
                  }`}
                >
                  ({countAllMembers})
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFilterCategory("present_members")}
                disabled={isSpinning}
                title="Chỉ thành viên Chapter có mặt (đã check-in)"
                className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-lg text-center transition cursor-pointer disabled:opacity-50 ${
                  filterCategory === "present_members"
                    ? "bg-[#cf142b] text-white font-bold shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/80 font-medium"
                }`}
              >
                <span className="text-[11px] leading-tight">Có mặt</span>
                <span
                  className={`text-[10px] leading-tight mt-0.5 ${
                    filterCategory === "present_members" ? "text-amber-200 font-bold" : "text-slate-400"
                  }`}
                >
                  ({countPresent})
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFilterCategory("guests")}
                disabled={isSpinning}
                title="Chỉ khách mời tham dự"
                className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-lg text-center transition cursor-pointer disabled:opacity-50 ${
                  filterCategory === "guests"
                    ? "bg-[#cf142b] text-white font-bold shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/80 font-medium"
                }`}
              >
                <span className="text-[11px] leading-tight">Khách mời</span>
                <span
                  className={`text-[10px] leading-tight mt-0.5 ${
                    filterCategory === "guests" ? "text-amber-200 font-bold" : "text-slate-400"
                  }`}
                >
                  ({countGuests})
                </span>
              </button>
            </div>

            {/* Search & Actions Bar */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm theo tên..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-[#cf142b] focus:bg-white shadow-2xs"
                />
              </div>

              <button
                type="button"
                onClick={handleShuffle}
                title="Xáo trộn danh sách"
                disabled={isSpinning}
                className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition cursor-pointer shadow-2xs"
              >
                <Shuffle className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={loadSystemUsers}
                title="Tải lại từ hệ thống iGen Connect"
                disabled={isSpinning || loadingUsers}
                className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition cursor-pointer shadow-2xs"
              >
                <RefreshCw className={`h-4 w-4 ${loadingUsers ? "animate-spin" : ""}`} />
              </button>
            </div>

            {/* Bulk Selection Actions */}
            <div className="flex items-center justify-between text-[11px] text-slate-500 border-b border-slate-100 pb-2">
              <div className="flex items-center gap-3 font-semibold">
                <button
                  type="button"
                  onClick={() => handleToggleSelectAll(true)}
                  className="text-[#cf142b] hover:text-[#990e1f] transition-colors cursor-pointer"
                >
                  Chọn tất cả
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => handleToggleSelectAll(false)}
                  className="text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                >
                  Bỏ chọn tất cả
                </button>
              </div>

              <span className="font-mono text-slate-500 text-[11px]">
                Đang chọn: <strong className="text-[#cf142b]">{activeParticipants.length}</strong>/{categoryParticipants.length}
              </span>
            </div>

            {/* Scrollable Members List */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {loadingUsers ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-2">
                  <RefreshCw className="h-6 w-6 animate-spin text-[#cf142b]" />
                  <span className="text-xs">Đang đồng bộ người dùng từ hệ thống...</span>
                </div>
              ) : filteredParticipants.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  {filterCategory === "present_members"
                    ? "Chưa có thành viên nào check-in hôm nay"
                    : filterCategory === "guests"
                    ? "Chưa có khách mời nào tham dự hôm nay"
                    : "Không tìm thấy người phù hợp"}
                </div>
              ) : (
                filteredParticipants.map((p, idx) => {
                  const ballNum =
                    selectedGame === "bingo" && p.selected
                      ? activeParticipants.findIndex((ap) => ap.id === p.id) + 1
                      : 0;

                  return (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between rounded-xl p-2.5 transition border ${
                        p.selected
                          ? "bg-white border-slate-200 text-slate-900 shadow-2xs hover:border-slate-300"
                          : "bg-slate-50/60 border-transparent text-slate-400 opacity-60"
                      }`}
                    >
                      <label className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={p.selected}
                          onChange={() => handleToggleParticipant(p.id)}
                          className="h-4 w-4 rounded accent-[#cf142b] cursor-pointer"
                        />

                        {/* Avatar or Initial */}
                        {p.avatar ? (
                          <img
                            src={p.avatar}
                            alt={p.name}
                            className="h-7 w-7 rounded-full object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div
                            className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-2xs"
                            style={{ backgroundColor: WHEEL_PALETTE[idx % WHEEL_PALETTE.length] }}
                          >
                            {p.name.slice(0, 1).toUpperCase()}
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="truncate text-xs font-bold text-slate-800">{p.name}</span>

                            {/* Bingo Ball Number Badge */}
                            {selectedGame === "bingo" && ballNum > 0 && (
                              <span
                                className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[9px] font-black text-white shrink-0 shadow-2xs"
                                style={{
                                  backgroundColor:
                                    LOTTERY_BALL_PALETTE[(ballNum - 1) % LOTTERY_BALL_PALETTE.length].mid,
                                }}
                                title={`Bóng số #${ballNum}`}
                              >
                                #{ballNum}
                              </span>
                            )}

                            {/* Presence / Type Badge */}
                            {p.type === "member_present" && (
                              <button
                                type="button"
                                onClick={(e) => handleTogglePresence(p.id, e)}
                                title="Bấm để chuyển sang Vắng mặt"
                                className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition cursor-pointer shrink-0"
                              >
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Có mặt
                              </button>
                            )}
                            {p.type === "member_absent" && (
                              <button
                                type="button"
                                onClick={(e) => handleTogglePresence(p.id, e)}
                                title="Bấm để chuyển sang Có mặt"
                                className="inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-500 border border-slate-200 hover:bg-slate-200 transition cursor-pointer shrink-0"
                              >
                                Vắng
                              </button>
                            )}
                            {p.type === "guest" && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-800 border border-amber-300 shrink-0">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                Khách
                              </span>
                            )}
                          </div>
                          {p.department && (
                            <div className="truncate text-[10px] text-slate-500">{p.department}</div>
                          )}
                        </div>
                      </label>

                    {/* Delete action */}
                    <button
                      type="button"
                      onClick={() => handleDeleteParticipant(p.id)}
                      title="Xóa khỏi danh sách quay"
                      className="p-1 text-slate-400 hover:text-rose-600 transition rounded cursor-pointer ml-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })
            )}
            </div>
          </div>
        )}

        {/* Tab 2: Winners History */}
        {activeDrawerTab === "winners" && (
          <div className="flex flex-1 flex-col overflow-hidden p-4 space-y-4 bg-white">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs text-slate-700 font-bold">Lịch sử trúng giải hôm nay</span>
              {winners.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportWinners}
                    className="flex items-center gap-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 text-[11px] font-bold hover:bg-emerald-100 transition cursor-pointer shadow-2xs"
                  >
                    <Download className="h-3 w-3" />
                    <span>Xuất CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm("Ẩn lịch sử trên màn hình này? Kết quả đã lưu vẫn được giữ trong thống kê cuộc họp.")) {
                        setWinners([]);
                      }
                    }}
                    className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                    title="Ẩn lịch sử trên màn hình"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {winners.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400 space-y-2">
                  <Trophy className="h-8 w-8 text-slate-300" />
                  <p className="text-xs">Chưa có ai trúng thưởng. Hãy bấm QUAY để bắt đầu!</p>
                </div>
              ) : (
                winners.map((w, idx) => (
                  <div
                    key={w.id}
                    className="flex items-center justify-between rounded-xl bg-amber-50/70 border border-amber-200/80 p-3 shadow-2xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-white font-black text-xs shrink-0 shadow-2xs">
                        #{winners.length - idx}
                      </div>
                      <div className="min-w-0">
                        <h4 className="truncate text-xs font-bold text-slate-900">{w.name}</h4>
                        <p className="text-[10px] text-amber-700 font-semibold truncate">{w.prizeName}</p>
                        <p className="text-[9px] text-slate-400 font-mono">{new Date(w.wonAt).toLocaleString("vi-VN")}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* WINNER POPUP CELEBRATION MODAL */}
      {/* ======================================================== */}
      {winnerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-3xl border-2 border-amber-300 bg-white p-8 text-center shadow-2xl overflow-hidden">
            {/* Top Close Icon */}
            <button
              type="button"
              onClick={() => setWinnerModal(null)}
              className="absolute right-4 top-4 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Glowing Backdrop Aura */}
            <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-48 w-48 rounded-full bg-amber-300/40 blur-3xl" />

            {/* Trophy & Badge */}
            <div className="relative mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-tr from-amber-500 to-yellow-400 p-4 shadow-xl shadow-amber-500/20">
              {winnerModal.ballNumber ? (
                <div className="flex flex-col items-center justify-center text-amber-950">
                  <span className="text-[10px] font-black uppercase tracking-wider">BÓNG SỐ</span>
                  <span className="text-2xl font-black">#{winnerModal.ballNumber}</span>
                </div>
              ) : (
                <Trophy className="h-10 w-10 text-white animate-bounce" />
              )}
            </div>

            <div className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3.5 py-1 text-xs font-black uppercase tracking-widest text-[#cf142b] border border-red-200 mb-3">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span>
                {winnerModal.ballNumber
                  ? `LỒNG CẦU BINGO • BÓNG SỐ #${winnerModal.ballNumber}`
                  : "CHÚC MỪNG CHIẾN THẮNG"}
              </span>
            </div>

            {/* Prize Label */}
            <p className="text-sm font-semibold text-slate-600 mb-2">
              Đã trúng: <span className="text-[#cf142b] font-bold">{winnerModal.prize}</span>
            </p>

            {/* Winner Big Display */}
            <div className="my-6 rounded-2xl bg-gradient-to-b from-amber-50 to-orange-50/60 border border-amber-200/80 p-6 shadow-inner">
              {winnerModal.winner.avatar ? (
                <img
                  src={winnerModal.winner.avatar}
                  alt={winnerModal.winner.name}
                  className="mx-auto mb-3 h-16 w-16 rounded-full object-cover border-2 border-amber-400 shadow-md"
                />
              ) : null}

              <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 drop-shadow-xs">
                {winnerModal.winner.name}
              </h2>

              {winnerModal.winner.department && (
                <p className="mt-1 text-xs sm:text-sm text-slate-500 font-medium">
                  {winnerModal.winner.department}
                </p>
              )}
            </div>

            {/* Actions for Wheel of Names / Bingo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {/* Option 1: Remove from wheel/cage so they don't win again */}
              <button
                type="button"
                onClick={() => handleRemoveWinnerFromWheel(winnerModal.winner.id)}
                className="flex items-center justify-center gap-2 rounded-2xl bg-rose-600 hover:bg-rose-700 px-5 py-3.5 text-xs font-bold text-white shadow-md transition active:scale-95 cursor-pointer"
              >
                <UserMinus className="h-4 w-4" />
                <span>{selectedGame === "bingo" ? "Loại khỏi lồng quay" : "Loại khỏi vòng quay"}</span>
              </button>

              {/* Option 2: Keep in wheel & Close */}
              <button
                type="button"
                onClick={() => setWinnerModal(null)}
                className="flex items-center justify-center gap-2 rounded-2xl bg-slate-900 hover:bg-slate-800 px-5 py-3.5 text-xs font-bold text-white transition active:scale-95 cursor-pointer shadow-md"
              >
                <Check className="h-4 w-4 text-emerald-400" />
                <span>Giữ lại & Đóng</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
