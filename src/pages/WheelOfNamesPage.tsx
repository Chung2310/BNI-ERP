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
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { authService } from "../services/authService";
import { UserProfile } from "../types";
import { playTickSound, playWinFanfare, playSuspenseSound } from "../utils/soundEffects";
import { launchConfetti } from "../utils/confetti";
import { BRAND_NAME, BRAND_LOGO_PATH } from "../config/brand";

interface Participant {
  id: string;
  name: string;
  avatar?: string;
  department?: string;
  role?: string;
  selected: boolean;
  isCustom?: boolean;
}

interface WinnerRecord {
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
  { start: "#f43f5e", mid: "#e11d48", end: "#881337", text: "#ffffff" }, // Crimson Ruby
  { start: "#fbbf24", mid: "#f59e0b", end: "#b45309", text: "#0f172a" }, // Imperial Amber Gold
  { start: "#10b981", mid: "#059669", end: "#064e3b", text: "#ffffff" }, // Jade Emerald
  { start: "#38bdf8", mid: "#0284c7", end: "#075985", text: "#ffffff" }, // Topaz Cyan
  { start: "#818cf8", mid: "#4f46e5", end: "#312e81", text: "#ffffff" }, // Royal Indigo
  { start: "#c084fc", mid: "#9333ea", end: "#581c87", text: "#ffffff" }, // Amethyst Purple
  { start: "#f472b6", mid: "#db2777", end: "#831843", text: "#ffffff" }, // Hot Magenta
  { start: "#fb923c", mid: "#ea580c", end: "#7c2d12", text: "#ffffff" }, // Sunset Tangerine
  { start: "#2dd4bf", mid: "#0d9488", end: "#134e4a", text: "#ffffff" }, // Ocean Teal
  { start: "#a3e635", mid: "#65a30d", end: "#365314", text: "#0f172a" }, // Electric Lime
  { start: "#60a5fa", mid: "#2563eb", end: "#1e3a8a", text: "#ffffff" }, // Sapphire Blue
  { start: "#e879f9", mid: "#c026d3", end: "#701a75", text: "#ffffff" }, // Neon Orchid
];

export interface DisplaySlice {
  participant: Participant;
  displayName: string;
  paletteIndex: number;
}

// Exactly 1 slice per active participant (1:1 mapping, no duplicate names, no icons)
const getDisplaySlices = (active: Participant[]): DisplaySlice[] => {
  return active.map((p, i) => ({
    participant: p,
    displayName: p.name,
    paletteIndex: i % LUXURY_PALETTE.length,
  }));
};

// Fallback sample participants for demo / unauthenticated state
const DEFAULT_PARTICIPANTS: Participant[] = [
  { id: "sample-1", name: "Nguyễn Văn An", department: "Ban Điều Hành", role: "Chủ tịch", selected: true },
  { id: "sample-2", name: "Trần Thị Mai", department: "Ban Khách Mời", role: "Phó Chủ tịch", selected: true },
  { id: "sample-3", name: "Lê Hoàng Long", department: "Ban Sự Kiện", role: "Trưởng ban", selected: true },
  { id: "sample-4", name: "Phạm Hồng Ngọc", department: "Ban Hội Viên", role: "Thành viên", selected: true },
  { id: "sample-5", name: "Đỗ Minh Quân", department: "Ban Đào Tạo", role: "Điều phối viên", selected: true },
  { id: "sample-6", name: "Vũ Phương Thảo", department: "Ban Truyền Thông", role: "Thành viên", selected: true },
  { id: "sample-7", name: "Bùi Tuấn Anh", department: "Ban Công Nghệ", role: "Thành viên", selected: true },
  { id: "sample-8", name: "Hoàng Gia Bảo", department: "Ban Tài Chính", role: "Thủ quỹ", selected: true },
];

export default function WheelOfNamesPage() {
  const { userProfile, loading: authLoading } = useAuth();

  // State
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [winners, setWinners] = useState<WinnerRecord[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [newGuestName, setNewGuestName] = useState("");
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
  } | null>(null);

  // Canvas & Physics Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentAngleRef = useRef(0);
  const animationFrameIdRef = useRef<number | null>(null);
  const lastTickIndexRef = useRef<number>(-1);
  const pointerBounceRef = useRef(0);
  const lightPhaseRef = useRef(0);
  const pulseAnimRef = useRef(0);

  // Active selected participants on the wheel
  const activeParticipants = participants.filter((p) => p.selected);

  // 1. Fetch Users directly from system
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

      if (users && users.length > 0) {
        const loaded: Participant[] = users.map((u) => ({
          id: u.uid || u.email,
          name: (u.displayName || u.email.split("@")[0]).trim(),
          avatar: u.photoURL,
          department: u.department || u.branchName || "Thành viên",
          role: u.role,
          selected: true,
        }));
        setParticipants(loaded);
      } else {
        setParticipants(DEFAULT_PARTICIPANTS);
      }
    } catch (err) {
      console.error("Lỗi khi tải danh sách người dùng cho vòng quay:", err);
      setParticipants(DEFAULT_PARTICIPANTS);
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

  // 3. Render Wheel onto Canvas with High-End Game Show Visuals
  const drawWheel = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Retina DPI scale
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const size = Math.min(rect.width, rect.height);
    if (size <= 0) return;

    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const rimWidth = 28;
    const radius = size / 2 - rimWidth - 14;
    const outerBezelRadius = radius + rimWidth;

    ctx.clearRect(0, 0, size, size);

    const slices = getDisplaySlices(activeParticipants);
    const sliceCount = slices.length;

    if (sliceCount === 0) {
      // Empty state with luxury frame
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, outerBezelRadius, 0, 2 * Math.PI);
      ctx.fillStyle = "#090d16";
      ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
      ctx.shadowBlur = 30;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
      ctx.fillStyle = "#0f172a";
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 4;
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#fef08a";
      ctx.font = "bold 18px sans-serif";
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
    ctx.fillStyle = "#030712";
    ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
    ctx.shadowBlur = 36;
    ctx.shadowOffsetY = 8;
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
    ctx.fillStyle = "#090d16";
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
      }

      // Text along Radial Ray
      ctx.save();
      ctx.translate(cx, cy);

      if (sliceCount === 1) {
        // When there is only 1 person, render cleanly in the upper hemisphere rotating with the wheel
        ctx.rotate(currentAngle);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "bold 24px sans-serif";
        ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
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
    ctx.fillStyle = "#030712";
    ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
    ctx.shadowBlur = 24;
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
    ctx.fillStyle = "#0f172a";
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
    hubGrad.addColorStop(0, "#fffbeb");
    hubGrad.addColorStop(0.2, "#fde68a");
    hubGrad.addColorStop(0.5, "#f59e0b");
    hubGrad.addColorStop(0.85, "#b45309");
    hubGrad.addColorStop(1, "#78350f");

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
  }, [activeParticipants, isSpinning]);

  // Keep wheel rendered on state changes
  useEffect(() => {
    drawWheel();
  }, [drawWheel]);

  // Idle animation for chasing marquee lights & glowing center button
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      if (!isSpinning && !document.hidden) {
        const delta = time - lastTime;
        if (delta >= 40) { // ~25fps throttle for smooth, low-CPU animation
          lastTime = time;
          lightPhaseRef.current = (lightPhaseRef.current + 0.1) % 28;
          pulseAnimRef.current = (pulseAnimRef.current + 0.06) % (2 * Math.PI);
          drawWheel();
        }
      }
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isSpinning, drawWheel]);

  // Resize handler for responsive canvas
  useEffect(() => {
    const handleResize = () => {
      drawWheel();
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [drawWheel]);

  // 4. Spin Execution with Smooth Deceleration & Authentic Physics
  const handleStartSpin = () => {
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

    // The pointer needle is at 0 rad (3 o'clock position / right side).
    // A slice at index i spans angle [angle + i*arc, angle + (i+1)*arc].
    // To have slice i intersect 0 rad, we want (angle + i*arc + arc/2) = 2*PI*k.
    // Hence targetAngle % 2*PI = 2*PI - (i * arc + arc/2).
    const currentAngle = currentAngleRef.current % (2 * Math.PI);
    const targetSliceCenter = 2 * Math.PI - (winningIndex * arc + arc / 2);

    // Number of full rotations for suspense (minimum 6 full turns)
    const extraRotations = 6 + Math.floor(Math.random() * 3);
    const totalAngleDelta = extraRotations * 2 * Math.PI + (targetSliceCenter - currentAngle) + (currentAngle > targetSliceCenter ? 2 * Math.PI : 0);

    const startTime = performance.now();
    const durationMs = spinDuration * 1000;
    const startAngle = currentAngleRef.current;

    // Quartic ease-out function
    const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);

    lastTickIndexRef.current = -1;

    const animateSpin = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);

      const easedProgress = easeOutQuart(progress);
      currentAngleRef.current = startAngle + totalAngleDelta * easedProgress;

      // Speed up marquee lights during spin
      lightPhaseRef.current = (lightPhaseRef.current + (1 - progress * 0.6) * 1.4) % 28;

      // Calculate which slice is currently passing under the pointer (at 0 rad / right edge)
      const normalizedAngle = (2 * Math.PI - (currentAngleRef.current % (2 * Math.PI))) % (2 * Math.PI);
      const currentPassingSlice = Math.floor(normalizedAngle / arc);

      if (currentPassingSlice !== lastTickIndexRef.current) {
        lastTickIndexRef.current = currentPassingSlice;
        // Mechanical tick sound & needle spring vibration
        if (soundEnabled) {
          const speedFactor = 1 - progress; // pitch varies with speed
          playTickSound(650 + speedFactor * 300);
        }
        pointerBounceRef.current = -0.32; // bounce up
      } else {
        // Damping spring back to 0
        pointerBounceRef.current *= 0.82;
      }

      drawWheel();

      if (progress < 1) {
        animationFrameIdRef.current = requestAnimationFrame(animateSpin);
      } else {
        // Finish Spin!
        pointerBounceRef.current = 0;
        drawWheel();
        setIsSpinning(false);

        const record: WinnerRecord = {
          id: `win-${Date.now()}`,
          name: winner.name,
          prizeName: currentPrize,
          avatar: winner.avatar,
          department: winner.department,
          wonAt: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        };

        setWinners((prev) => [record, ...prev]);

        // Celebration
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
      role: "Khách",
      selected: true,
      isCustom: true,
    };
    setParticipants((prev) => [newParticipant, ...prev]);
    setNewGuestName("");
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

  // Select / Deselect all
  const handleToggleSelectAll = (select: boolean) => {
    if (isSpinning) return;
    setParticipants((prev) => prev.map((p) => ({ ...p, selected: select })));
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

  // Filtered participants list for sidebar
  const filteredParticipants = participants.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.department && p.department.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-slate-950 font-sans text-white select-none">
      {/* Background Ambient Glows */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-blue-600/10 blur-[140px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[600px] w-[600px] rounded-full bg-amber-500/10 blur-[140px]" />
      <div className="pointer-events-none absolute top-1/2 left-1/3 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-purple-600/10 blur-[160px]" />

      {/* Main Wheel Area */}
      <div className="flex flex-1 flex-col h-full overflow-hidden">
        {/* Top Header Bar */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 bg-slate-900/60 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex items-center gap-3">
            <a
              href="/"
              title="Quay lại hệ thống"
              className="flex items-center gap-2 rounded-xl p-2 text-slate-400 hover:bg-white/10 hover:text-white transition"
            >
              <ArrowLeft className="h-5 w-5" />
            </a>

            <div className="flex items-center gap-2.5">
              <img
                src={BRAND_LOGO_PATH}
                alt={BRAND_NAME}
                className="h-8 w-8 rounded-lg border border-white/20 object-cover shadow-sm"
              />
              <div>
                <h1 className="flex items-center gap-2 text-sm font-black tracking-tight text-white sm:text-base">
                  <span>VÒNG QUAY MAY MẮN</span>
                  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/30 uppercase tracking-widest">
                    {userProfile?.companyName || userProfile?.companyCode || "iGen Connect"}
                  </span>
                </h1>
              </div>
            </div>
          </div>

          {/* Center Prize Display / Edit */}
          <div className="hidden md:flex items-center gap-2">
            {isEditingPrize ? (
              <div className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 border border-amber-400/40">
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
                  className="bg-transparent text-xs font-bold text-amber-300 outline-none w-48 text-center"
                />
                <button
                  type="button"
                  onClick={() => {
                    setCurrentPrize(prizeInput.trim() || "Giải Thưởng May Mắn");
                    setIsEditingPrize(false);
                  }}
                  className="text-emerald-400 hover:text-emerald-300 p-1"
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
                className="group flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-4 py-1.5 text-xs font-bold text-amber-300 transition hover:bg-amber-500/20 hover:border-amber-400/60 cursor-pointer shadow-sm"
              >
                <Trophy className="h-4 w-4 text-amber-400 group-hover:scale-110 transition-transform" />
                <span>{currentPrize}</span>
                <span className="text-[10px] text-amber-400/60 group-hover:text-amber-300 underline">Đổi</span>
              </button>
            )}
          </div>

          {/* Right Action Icons */}
          <div className="flex items-center gap-2">
            {/* Spin Duration Selector */}
            <div className="hidden sm:flex items-center rounded-xl bg-white/5 p-1 border border-white/10">
              <Clock className="h-3.5 w-3.5 text-slate-400 ml-1.5 mr-1" />
              {[5, 8, 12].map((dur) => (
                <button
                  key={dur}
                  type="button"
                  onClick={() => setSpinDuration(dur)}
                  disabled={isSpinning}
                  className={`rounded-lg px-2 py-0.5 text-[10px] font-bold transition ${
                    spinDuration === dur
                      ? "bg-amber-500 text-slate-950 shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {dur}s
                </button>
              ))}
            </div>

            {/* Sound Toggle */}
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? "Tắt âm thanh" : "Bật âm thanh"}
              className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 hover:bg-white/10 hover:text-white transition cursor-pointer"
            >
              {soundEnabled ? <Volume2 className="h-4 w-4 text-emerald-400" /> : <VolumeX className="h-4 w-4 text-rose-400" />}
            </button>

            {/* Fullscreen Toggle */}
            <button
              type="button"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Thu nhỏ (F)" : "Toàn màn hình (F)"}
              className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 hover:bg-white/10 hover:text-white transition cursor-pointer"
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>

            {/* Toggle Drawer */}
            <button
              type="button"
              onClick={() => setIsDrawerOpen(!isDrawerOpen)}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition cursor-pointer ${
                isDrawerOpen
                  ? "border-amber-400/40 bg-amber-500/20 text-amber-300"
                  : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Thành viên ({activeParticipants.length})</span>
            </button>
          </div>
        </header>

        {/* Stage Content */}
        <div className="relative flex flex-1 items-center justify-center p-4 overflow-hidden">
          {/* Ambient Stage Spotlight Glow */}
          <div
            className="pointer-events-none absolute h-[650px] w-[650px] rounded-full bg-gradient-to-tr from-amber-500/20 via-yellow-400/10 to-transparent blur-[130px] animate-pulse"
            style={{ animationDuration: "5s" }}
          />

          {/* Main Wheel Canvas Container */}
          <div className="relative flex aspect-square h-[90vh] max-h-[900px] w-full max-w-[900px] items-center justify-center drop-shadow-[0_0_50px_rgba(245,158,11,0.2)]">
            <canvas
              ref={canvasRef}
              onClick={handleStartSpin}
              title={isSpinning ? "Đang quay..." : "Nhấn nút QUAY ở giữa để bắt đầu"}
              className={`h-full w-full select-none transition-transform duration-300 ${
                isSpinning ? "cursor-not-allowed scale-[1.01]" : "cursor-pointer hover:scale-[1.015]"
              }`}
            />
          </div>
        </div>
      </div>

      {/* Right Collapsible Participants & Winners Drawer */}
      <div
        className={`flex flex-col border-l border-white/10 bg-slate-900/80 backdrop-blur-2xl transition-all duration-300 z-30 ${
          isDrawerOpen ? "w-80 sm:w-96" : "w-0 opacity-0 overflow-hidden pointer-events-none"
        }`}
      >
        {/* Drawer Tabs */}
        <div className="flex items-center border-b border-white/10 p-2">
          <button
            type="button"
            onClick={() => setActiveDrawerTab("participants")}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-bold transition cursor-pointer ${
              activeDrawerTab === "participants"
                ? "bg-amber-500 text-slate-950 shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Thành viên ({activeParticipants.length}/{participants.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveDrawerTab("winners")}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-bold transition cursor-pointer ${
              activeDrawerTab === "winners"
                ? "bg-amber-500 text-slate-950 shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Trophy className="h-4 w-4" />
            <span>Trúng giải ({winners.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setIsDrawerOpen(false)}
            className="p-2 text-slate-400 hover:text-white rounded-lg ml-1"
            title="Đóng bảng bên"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Tab 1: Participants List */}
        {activeDrawerTab === "participants" && (
          <div className="flex flex-1 flex-col overflow-hidden p-4 space-y-4">
            {/* Quick Add Guest Form */}
            <form onSubmit={handleAddGuest} className="relative">
              <input
                type="text"
                placeholder="+ Thêm khách mời / người mới..."
                value={newGuestName}
                onChange={(e) => setNewGuestName(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-800/80 px-3.5 py-2.5 text-xs text-white placeholder-slate-400 outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/40"
              />
              <button
                type="submit"
                disabled={!newGuestName.trim()}
                className="absolute right-1.5 top-1.5 rounded-lg bg-amber-500 p-1.5 text-slate-950 disabled:opacity-40 hover:bg-amber-400 transition cursor-pointer"
              >
                <UserPlus className="h-3.5 w-3.5" />
              </button>
            </form>

            {/* Search & Actions Bar */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm theo tên..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-800/50 pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-400/50"
                />
              </div>

              <button
                type="button"
                onClick={handleShuffle}
                title="Xáo trộn danh sách"
                disabled={isSpinning}
                className="rounded-xl border border-white/10 bg-slate-800 p-2 text-slate-300 hover:text-white transition cursor-pointer"
              >
                <Shuffle className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={loadSystemUsers}
                title="Tải lại từ hệ thống iGen Connect"
                disabled={isSpinning || loadingUsers}
                className="rounded-xl border border-white/10 bg-slate-800 p-2 text-slate-300 hover:text-white transition cursor-pointer"
              >
                <RefreshCw className={`h-4 w-4 ${loadingUsers ? "animate-spin" : ""}`} />
              </button>
            </div>

            {/* Bulk Selection Actions */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-white/10 pb-2">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleToggleSelectAll(true)}
                  className="hover:text-amber-300 transition cursor-pointer"
                >
                  Chọn tất cả
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => handleToggleSelectAll(false)}
                  className="hover:text-amber-300 transition cursor-pointer"
                >
                  Bỏ chọn tất cả
                </button>
              </div>

              <span className="font-mono text-slate-500">
                {activeParticipants.length}/{participants.length}
              </span>
            </div>

            {/* Scrollable Members List */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {loadingUsers ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500 space-y-2">
                  <RefreshCw className="h-6 w-6 animate-spin text-amber-400" />
                  <span className="text-xs">Đang đồng bộ người dùng từ hệ thống...</span>
                </div>
              ) : filteredParticipants.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  Không tìm thấy thành viên phù hợp
                </div>
              ) : (
                filteredParticipants.map((p, idx) => (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between rounded-xl p-2.5 transition border ${
                      p.selected
                        ? "bg-slate-800/80 border-white/10 text-white"
                        : "bg-slate-900/40 border-transparent text-slate-500 opacity-60"
                    }`}
                  >
                    <label className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={p.selected}
                        onChange={() => handleToggleParticipant(p.id)}
                        className="h-4 w-4 rounded accent-amber-500 cursor-pointer"
                      />

                      {/* Avatar or Initial */}
                      {p.avatar ? (
                        <img
                          src={p.avatar}
                          alt={p.name}
                          className="h-7 w-7 rounded-full object-cover border border-white/20 shrink-0"
                        />
                      ) : (
                        <div
                          className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                          style={{ backgroundColor: WHEEL_PALETTE[idx % WHEEL_PALETTE.length] }}
                        >
                          {p.name.slice(0, 1).toUpperCase()}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-bold">{p.name}</div>
                        {p.department && (
                          <div className="truncate text-[10px] text-slate-400">{p.department}</div>
                        )}
                      </div>
                    </label>

                    {/* Delete action */}
                    <button
                      type="button"
                      onClick={() => handleDeleteParticipant(p.id)}
                      title="Xóa khỏi danh sách quay"
                      className="p-1 text-slate-500 hover:text-rose-400 transition rounded"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Winners History */}
        {activeDrawerTab === "winners" && (
          <div className="flex flex-1 flex-col overflow-hidden p-4 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <span className="text-xs text-slate-400 font-bold">Lịch sử trúng giải hôm nay</span>
              {winners.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportWinners}
                    className="flex items-center gap-1 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 px-2 py-1 text-[11px] font-bold hover:bg-emerald-600/30 transition cursor-pointer"
                  >
                    <Download className="h-3 w-3" />
                    <span>Xuất CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử trúng giải?")) {
                        setWinners([]);
                      }
                    }}
                    className="p-1 text-slate-500 hover:text-rose-400 transition"
                    title="Xóa lịch sử"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {winners.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500 space-y-2">
                  <Trophy className="h-8 w-8 text-slate-600" />
                  <p className="text-xs">Chưa có ai trúng thưởng. Hãy bấm QUAY để bắt đầu!</p>
                </div>
              ) : (
                winners.map((w, idx) => (
                  <div
                    key={w.id}
                    className="flex items-center justify-between rounded-xl bg-slate-800/80 border border-amber-400/20 p-3 shadow-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 border border-amber-400/40 text-xs font-black shrink-0">
                        #{winners.length - idx}
                      </div>
                      <div className="min-w-0">
                        <h4 className="truncate text-xs font-bold text-white">{w.name}</h4>
                        <p className="text-[10px] text-amber-300 truncate">{w.prizeName}</p>
                        <p className="text-[9px] text-slate-500 font-mono">{w.wonAt}</p>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-3xl border-2 border-amber-400/60 bg-linear-to-b from-slate-900 via-indigo-950 to-slate-900 p-8 text-center shadow-[0_0_80px_rgba(245,158,11,0.5)] overflow-hidden">
            {/* Top Close Icon */}
            <button
              type="button"
              onClick={() => setWinnerModal(null)}
              className="absolute right-4 top-4 rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Glowing Backdrop Aura */}
            <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-48 w-48 rounded-full bg-amber-400/30 blur-3xl" />

            {/* Trophy & Badge */}
            <div className="relative mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-linear-to-tr from-amber-500 to-yellow-300 p-4 shadow-xl shadow-amber-500/30">
              <Trophy className="h-10 w-10 text-slate-950 animate-bounce" />
            </div>

            <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/20 px-3.5 py-1 text-xs font-black uppercase tracking-widest text-amber-300 border border-amber-400/40 mb-3">
              <Sparkles className="h-3.5 w-3.5" />
              <span>CHÚC MỪNG CHIẾN THẮNG</span>
            </div>

            {/* Prize Label */}
            <p className="text-sm font-semibold text-slate-300 mb-2">
              Đã trúng: <span className="text-amber-300 font-bold">{winnerModal.prize}</span>
            </p>

            {/* Winner Big Display */}
            <div className="my-6 rounded-2xl bg-black/40 border border-white/10 p-6 shadow-inner">
              {winnerModal.winner.avatar ? (
                <img
                  src={winnerModal.winner.avatar}
                  alt={winnerModal.winner.name}
                  className="mx-auto mb-3 h-16 w-16 rounded-full object-cover border-2 border-amber-400 shadow-md"
                />
              ) : null}

              <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.6)]">
                {winnerModal.winner.name}
              </h2>

              {winnerModal.winner.department && (
                <p className="mt-1 text-xs sm:text-sm text-slate-400 font-medium">
                  {winnerModal.winner.department}
                </p>
              )}
            </div>

            {/* Actions for Wheel of Names */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {/* Option 1: Remove from wheel so they don't win again */}
              <button
                type="button"
                onClick={() => handleRemoveWinnerFromWheel(winnerModal.winner.id)}
                className="flex items-center justify-center gap-2 rounded-2xl bg-rose-600/90 hover:bg-rose-500 px-5 py-3.5 text-xs font-bold text-white shadow-lg transition active:scale-95 cursor-pointer"
              >
                <UserMinus className="h-4 w-4" />
                <span>Loại khỏi vòng quay</span>
              </button>

              {/* Option 2: Keep in wheel & Close */}
              <button
                type="button"
                onClick={() => setWinnerModal(null)}
                className="flex items-center justify-center gap-2 rounded-2xl bg-slate-800 hover:bg-slate-700 px-5 py-3.5 text-xs font-bold text-slate-200 border border-white/10 transition active:scale-95 cursor-pointer"
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
