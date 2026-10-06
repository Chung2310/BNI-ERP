// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LuckyDrawTab } from "./LuckyDrawTab";
import { meetingService, type LuckyDrawPrize, type Meeting } from "../../services/meetingService";

vi.mock("../../utils/soundEffects", () => ({
  playTickSound: vi.fn(),
  playWinFanfare: vi.fn(),
  playSuspenseSound: vi.fn(),
}));
vi.mock("../../utils/confetti", () => ({ launchConfetti: vi.fn() }));
vi.mock("../../pages/Toast", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

const prize: LuckyDrawPrize = {
  id: "prize-1",
  name: "Test prize",
  reward: "Test reward",
  quantity: 1,
  order: 1,
  color: "#f59e0b",
  winners: [],
};

const meeting = {
  _id: "meeting-1",
  companyCode: "TEST",
  revision: 1,
  __v: 1,
  title: "Weekly meeting",
  status: "live",
  startsAt: "2030-01-01T00:00:00.000Z",
  speakers: [{ id: "speaker-1", name: "Winner Person", seconds: 30, checkedInAt: "2030-01-01T00:00:00.000Z" }],
  tiers: [],
  fallbackSeconds: 30,
  reminderDays: 0,
  currentIndex: 0,
  elapsedSeconds: 0,
  luckyDraw: {
    enabled: true,
    allowRepeatWinners: false,
    drawMode: "attendees",
    numberMin: 1,
    numberMax: 100,
    prizes: [prize],
  },
} as Meeting;

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it("shows the normal-draw result from the spin response even when refresh returns no update", async () => {
  const winner = {
    id: "winner-1",
    prizeId: prize.id,
    prizeName: prize.name,
    winnerId: "speaker-1",
    name: "Winner Person",
    ticketNumber: 1,
    wonAt: "2030-01-01T00:00:05.000Z",
  };
  const updatedPrize = { ...prize, winners: [winner] };
  vi.spyOn(meetingService, "spinLuckyDraw").mockResolvedValue({
    winner,
    prize: updatedPrize,
    verificationHash: "hash",
    seed: "seed",
    timestamp: winner.wonAt,
    remainingEligibleCount: 0,
  });
  const refresh = vi.fn().mockResolvedValue(undefined);

  render(<LuckyDrawTab meeting={meeting} canManage onRefreshMeeting={refresh} />);
  fireEvent.click(screen.getByRole("button", { name: /Quay th/ }));

  await act(async () => {
    await Promise.resolve();
    vi.advanceTimersByTime(4_650);
    await Promise.resolve();
  });

  expect(screen.getByText("Winner Person", { selector: "h5" })).toBeTruthy();
  expect(screen.getByText("1 / 1", { exact: false })).toBeTruthy();
  expect(screen.getByText("Winner Person", { selector: "tbody *" })).toBeTruthy();
  expect(refresh).toHaveBeenCalledOnce();
});

it("shows wheel results when the meeting has no configured prizes", () => {
  const gameWinner = {
    id: "game-winner-1",
    prizeId: "game-winner-1",
    prizeName: "Default lucky prize",
    winnerId: "speaker-1",
    name: "External Winner",
    source: "wheel" as const,
    wonAt: "2030-01-01T00:00:05.000Z",
  };
  const meetingWithoutPrizes = {
    ...meeting,
    luckyDraw: { ...meeting.luckyDraw!, prizes: [] },
    gameWinners: [gameWinner],
  };

  render(<LuckyDrawTab meeting={meetingWithoutPrizes} canManage onRefreshMeeting={vi.fn()} />);

  expect(screen.getByText("Default lucky prize")).toBeTruthy();
  expect(screen.getByText("External Winner", { selector: "tbody *" })).toBeTruthy();
});
