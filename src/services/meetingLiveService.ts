import type { Meeting } from "./meetingService";
import type { ProfileSlide } from "../components/meetings/slideTypes";
import { tabToPath } from "../seo/seo-config";

export interface MeetingLiveSnapshot { meeting: Meeting; slides: ProfileSlide[]; serverNow: number; serverReceivedAt?: number }
export class MeetingLiveError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export function meetingRoomUrl(id: string, mode: "control" | "display") {
  return tabToPath("CUỘC HỌP") + "?meeting=" + encodeURIComponent(id) + "&mode=" + mode;
}
export async function meetingLiveApi<T = unknown>(path: string, method = "GET", body?: unknown, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timeout = window.setTimeout(abort, 15000);
  try {
    const response = await fetch("/api/v1/meetings" + path, {
      method, signal: controller.signal, cache: "no-store",
      headers: { Authorization: "Bearer " + (localStorage.getItem("accessToken") || ""),
        ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const result = await response.json();
    if (!response.ok) throw new MeetingLiveError(result.message || "Không thể kết nối cuộc họp.", response.status);
    return result.data as T;
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}
