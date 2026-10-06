// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AudienceResponsesStage } from "./AudienceResponsesStage";
import { buildResponseCloud, layoutResponseCloud } from "./audienceResponseCloud";
import { meetingInteractionService } from "../../services/meetingInteractionService";

vi.mock("../../services/socketService", () => ({ socketService: { on: vi.fn(() => () => undefined) } }));
vi.mock("../../services/meetingInteractionService", () => ({ meetingInteractionService: { get: vi.fn() } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

it("shows only approved answers and combines duplicates on the shared screen", async () => {
  const observe = vi.fn();
  vi.stubGlobal("ResizeObserver", class { observe = observe; disconnect = vi.fn(); });
  vi.mocked(meetingInteractionService.get).mockResolvedValue({
    session: { id: "i", meetingId: "m", question: "Một từ cho hôm nay?", status: "open", requireName: true, showNames: true, moderationEnabled: true, allowMultipleResponses: false, participationUrl: "/meeting-interaction/token", responseCount: 3, approvedCount: 2 },
    responses: [
      { id: "one", participantId: "p1", name: "An", answer: "Kết nối", status: "approved", createdAt: new Date().toISOString() },
      { id: "two", participantId: "p2", name: "Bình", answer: "Chưa duyệt", status: "pending", createdAt: new Date().toISOString() },
      { id: "three", participantId: "p3", name: "Chi", answer: "kết nối", status: "approved", createdAt: new Date().toISOString() },
    ],
  });
  render(<AudienceResponsesStage meeting={{ _id: "m", title: "Demo" } as never} />);
  expect(await screen.findByText("Kết nối")).toBeTruthy();
  expect(screen.getByTitle("Kết nối: 2 câu trả lời")).toBeTruthy();
  expect(screen.queryByText("An")).toBeNull();
  expect(screen.queryByText("Chưa duyệt")).toBeNull();
  await waitFor(() => expect(observe).toHaveBeenCalled());
});

it("groups equivalent approved answers and orders them by frequency", () => {
  const terms = buildResponseCloud({ session: null, responses: [
    { id: "1", participantId: "p1", name: "A", answer: " Kết   nối ", status: "approved", createdAt: "" },
    { id: "2", participantId: "p2", name: "B", answer: "kết nối", status: "approved", createdAt: "" },
    { id: "3", participantId: "p3", name: "C", answer: "Học hỏi", status: "approved", createdAt: "" },
    { id: "4", participantId: "p4", name: "D", answer: "Không duyệt", status: "pending", createdAt: "" },
  ] });
  expect(terms.map(term => [term.text, term.count])).toEqual([["Kết nối", 2], ["Học hỏi", 1]]);
});
it("automatically sizes, rotates and packs cloud terms without overlap", () => {
  const terms = Array.from({ length: 18 }, (_, index) => ({
    key: `term-${index}`,
    text: `Câu ${index}`,
    count: index === 0 ? 8 : index < 4 ? 3 : 1,
    firstIndex: index,
  }));
  const layout = layoutResponseCloud(terms, 1000, 430);
  expect(layout).toHaveLength(terms.length);
  expect(layout.find(term => term.key === "term-0")!.fontSize).toBeGreaterThan(layout.find(term => term.key === "term-10")!.fontSize);
  expect(layout.some(term => term.vertical)).toBe(true);
  const left = Math.min(...layout.map(term => term.x));
  const right = Math.max(...layout.map(term => term.x + term.width));
  const top = Math.min(...layout.map(term => term.y));
  const bottom = Math.max(...layout.map(term => term.y + term.height));
  expect((left + right) / 2).toBeCloseTo(500, 5);
  expect((top + bottom) / 2).toBeCloseTo(215, 5);
  for (let first = 0; first < layout.length; first++) for (let second = first + 1; second < layout.length; second++) {
    const a = layout[first]; const b = layout[second];
    const overlaps = a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
    expect(overlaps).toBe(false);
  }
});