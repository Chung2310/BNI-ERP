import type { MeetingPresentationState } from "../utils/meetingPresentation";
import type { SpeakingTimeSlot } from "../utils/meetingSpeakingTime";
import { getAccessToken } from "./authService";

function getAuthHeaders() {
  const token = getAccessToken();
  return {
    "Content-Type": "application/json",
    Authorization: token ? `Bearer ${token}` : "",
  };
}

export interface Speaker {
  company?: string;
  industry?: string;
  phone?: string;
  slideProfile?: { company?: string; industry?: string; phone?: string };
  id: string;
  userId?: string;
  name: string;
  email?: string;
  photoURL?: string;
  coverImage?: string;
  checkedInAt: string;
  seconds: number;
  spokenSeconds?: number;
}

export interface LuckyDrawWinner {
  source?: "wheel" | "bingo" | "draw";
  reward?: string;
  id: string;
  prizeId: string;
  prizeName: string;
  winnerId: string;
  userId?: string;
  name: string;
  email?: string;
  photoURL?: string;
  coverImage?: string;
  ticketNumber?: number;
  wonAt: string;
  drawnBy?: string;
  verificationHash?: string;
  seed?: string;
  timestamp?: string;
}

export interface LuckyDrawPrize {
  id: string;
  name: string;
  reward: string;
  quantity: number;
  order: number;
  imageUrl?: string;
  color?: string;
  winners: LuckyDrawWinner[];
}

export interface LuckyDrawConfig {
  enabled: boolean;
  allowRepeatWinners: boolean;
  drawMode: "attendees" | "numbers";
  numberMin: number;
  numberMax: number;
  prizes: LuckyDrawPrize[];
}

export interface Meeting {
  _id: string;
  companyCode: string;
  title: string;
  description?: string;
  location?: string;
  coverImage?: string;
  startsAt: string;
    endsAt?: string;
  startedAt?: string;
  createdBy?: string;
  reminderMinutes?: number;
  revision: number;
  status: "scheduled" | "live" | "paused" | "ended" | "cancelled";
  speakers: Speaker[];
  presentation?: MeetingPresentationState;
  speechesCompletedAt?: string;
  currentIndex: number;
  speakerStartedAt?: string;
  elapsedSeconds?: number;
  endedAt?: string;
  luckyDraw?: LuckyDrawConfig;
  gameWinners?: LuckyDrawWinner[];
  __v: number;
}

export const meetingService = {
  async recordGameWinner(meetingId: string, winner: Pick<LuckyDrawWinner, "id" | "winnerId" | "name" | "prizeName" | "photoURL" | "ticketNumber" | "wonAt"> & { source: "wheel" | "bingo" }): Promise<LuckyDrawWinner> {
    const res = await fetch(`/api/v1/meetings/${meetingId}/lucky-draw/results`, {
      method: "POST", headers: getAuthHeaders(), body: JSON.stringify(winner),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Không thể lưu kết quả quay thưởng.");
    return data.data;
  },
  async listMeetings(options: { all?: boolean } = {}): Promise<Meeting[]> {
    const res = await fetch("/api/v1/meetings" + (options.all ? "?history=all" : ""), {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Không thể tải danh sách cuộc họp.");
    return data.data || [];
  },

  async getMeeting(id: string): Promise<Meeting> {
    const res = await fetch(`/api/v1/meetings/${id}`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Không thể tải thông tin cuộc họp.");
    return data.data;
  },

  async createMeeting(payload: {
    title: string;
    description?: string;
    location?: string;
    coverImage?: string;
    startsAt: string;
    endsAt?: string;
    reminderMinutes?: number;
    tiers: SpeakingTimeSlot[];
    fallbackSeconds: number;
  }): Promise<Meeting> {
    const res = await fetch("/api/v1/meetings", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Không thể tạo cuộc họp mới.");
    return data.data;
  },

  async updateMeeting(
    id: string,
    payload: Partial<{
      title: string;
      description: string;
      location: string;
      coverImage: string;
      startsAt: string;
    endsAt?: string;
      reminderDays: number;
      tiers: SpeakingTimeSlot[];
      fallbackSeconds: number;
    }>
  ): Promise<Meeting> {
    const res = await fetch(`/api/v1/meetings/${id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Không thể cập nhật cuộc họp.");
    return data.data;
  },

  async deleteMeeting(id: string): Promise<void> {
    const res = await fetch(`/api/v1/meetings/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Không thể xóa cuộc họp.");
  },


  async checkIn(
    meetingId: string,
    payload: { latitude?: number; longitude?: number; userId?: string; name?: string; email?: string; photoURL?: string; coverImage?: string }
  ): Promise<Meeting> {
    const res = await fetch(`/api/v1/meetings/${meetingId}/checkin`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Check-in thất bại.");
    return data.data;
  },

  async controlMeeting(
    meetingId: string,
    action: "start" | "pause" | "resume" | "next" | "finish" | "cancel",
    version: number
  ): Promise<Meeting> {
    const res = await fetch(`/api/v1/meetings/${meetingId}/control`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ action, version }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Thao tác điều khiển thất bại.");
    return data.data;
  },

  // ==========================================
  // LUCKY DRAW (QUAY THƯỞNG)
  // ==========================================

  async getLuckyDraw(meetingId: string): Promise<{
    meetingId: string;
    status: Meeting["status"];
    meetingStarted: boolean;
    attendeesCount: number;
    speakers: Speaker[];
    luckyDraw: LuckyDrawConfig;
  }> {
    const res = await fetch(`/api/v1/meetings/${meetingId}/lucky-draw`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Không thể tải dữ liệu quay thưởng.");
    return data.data;
  },

  async updateLuckyDrawConfig(
    meetingId: string,
    config: Partial<LuckyDrawConfig>
  ): Promise<LuckyDrawConfig> {
    const res = await fetch(`/api/v1/meetings/${meetingId}/lucky-draw/config`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(config),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Không thể cập nhật cấu hình quay thưởng.");
    return data.data;
  },

  async addOrUpdatePrize(
    meetingId: string,
    prize: Partial<LuckyDrawPrize>
  ): Promise<LuckyDrawConfig> {
    const res = await fetch(`/api/v1/meetings/${meetingId}/lucky-draw/prizes`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(prize),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Không thể lưu giải thưởng.");
    return data.data;
  },

  async deletePrize(meetingId: string, prizeId: string): Promise<LuckyDrawConfig> {
    const res = await fetch(`/api/v1/meetings/${meetingId}/lucky-draw/prizes/${prizeId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Không thể xóa giải thưởng.");
    return data.data;
  },

  /**
   * Quay thưởng: Chỉ thực hiện khi cuộc họp đã bắt đầu!
   */
  async spinLuckyDraw(
    meetingId: string,
    prizeId: string
  ): Promise<{
    winner: LuckyDrawWinner;
    prize: LuckyDrawPrize;
    verificationHash: string;
    seed: string;
    timestamp: string;
    remainingEligibleCount: number;
  }> {
    const res = await fetch(`/api/v1/meetings/${meetingId}/lucky-draw/spin`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ prizeId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Quay thưởng thất bại.");
    return data.data;
  },

  async redrawWinner(
    meetingId: string,
    prizeId: string,
    winnerRecordId: string
  ): Promise<LuckyDrawPrize> {
    const res = await fetch(`/api/v1/meetings/${meetingId}/lucky-draw/redraw`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ prizeId, winnerRecordId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Hủy lượt quay thất bại.");
    return data.data;
  },

  async resetWinners(meetingId: string, prizeId?: string): Promise<LuckyDrawConfig> {
    const res = await fetch(`/api/v1/meetings/${meetingId}/lucky-draw/reset`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ prizeId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Đặt lại danh sách trúng giải thất bại.");
    return data.data;
  },
};
