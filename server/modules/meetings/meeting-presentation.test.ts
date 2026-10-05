import { afterEach, expect, it, vi } from "vitest";
vi.mock("../../socket", () => ({ emitToCompany: vi.fn() }));
vi.mock("../../service/notification.service", () => ({ notificationService: { createNotification: vi.fn() } }));
import { MeetingModel } from "./meeting.model";
import { advanceDuePresentations, isAutoAdvanceDue, updatePresentationState } from "./meeting-presentation.service";
import { startMeetingPresentation, spinLuckyDraw } from "./meeting.service";
import { presentationStateInput } from "./meeting.validation";

afterEach(() => vi.restoreAllMocks());
const origin = new Date("2030-01-01T01:00:00Z");
function meeting() {
  const item = MeetingModel.hydrate({ _id: "507f1f77bcf86cd799439011", companyCode: "BNI", __v: 0, status: "live", currentIndex: 0,
    presentation: { view: "speaker", autoAdvance: true, autoAdvanceDelay: 3 },
    speakerStartedAt: origin, elapsedSeconds: 0, fallbackSeconds: 30, tiers: [],
    speakers: [{ id: "first", name: "An", seconds: 30 }, { id: "second", name: "Binh", seconds: 20 }],
  });
  item.save = vi.fn(async () => item);
  return item as any;
}
it.each([0, 3, 150])("advances only after the speech and %s seconds of server-managed delay", async delay => {
  const item = meeting(); item.presentation.autoAdvanceDelay = delay;
  vi.spyOn(MeetingModel, "find").mockResolvedValue([item]);
  expect(await advanceDuePresentations(new Date(+origin + (30 + delay) * 1000 - 1))).toBe(0);
  expect(await advanceDuePresentations(new Date(+origin + (30 + delay) * 1000))).toBe(1);
  expect(item.currentIndex).toBe(1);
  expect(+item.speakerStartedAt).toBe(+origin + (30 + delay) * 1000);
});
it("preserves pause, manual mode and an unstarted clock", () => {
  const late = new Date(+origin + 100000);
  for (const patch of [{ status: "paused" }, { status: "scheduled" }, { status: "ended" }, { speakerStartedAt: undefined }, { presentation: { autoAdvance: false } }, { currentIndex: 2 }]) {
    expect(isAutoAdvanceDue({ ...meeting().toObject(), ...patch }, late)).toBe(false);
  }
});
it("counts elapsed time before a pause and completes speeches without ending the meeting", async () => {
  const item = meeting(); item.currentIndex = 1; item.elapsedSeconds = 15;
  vi.spyOn(MeetingModel, "find").mockResolvedValue([item]);
  expect(await advanceDuePresentations(new Date(+origin + 8000))).toBe(1);
  expect(item.currentIndex).toBe(2); expect(item.speechesCompletedAt).toBeTruthy();
  expect(item.status).toBe("live");
  expect(await advanceDuePresentations(new Date(+origin + 9000))).toBe(0);
});
it("allows only one of two concurrent scheduler workers to advance a version", async () => {
  let version = 0;
  vi.spyOn(MeetingModel, "find").mockImplementation((() => {
    const item = meeting();
    item.save = async () => {
      if (item.__v !== version) throw Object.assign(new Error("race"), { name: "VersionError" });
      item.__v = ++version;
    };
    return Promise.resolve([item]);
  }) as any);
  const results = await Promise.all([advanceDuePresentations(new Date(+origin + 40000)), advanceDuePresentations(new Date(+origin + 40000))]);
  expect(results.reduce((sum, value) => sum + value, 0)).toBe(1);
  expect(version).toBe(1);
  expect(MeetingModel.schema.options.optimisticConcurrency).toBe(true);
});
it("persists presentation configuration while retaining draw state", async () => {
  const item = new MeetingModel({ companyCode: "BNI", title: "Demo", presentation: { drawWinnerId: "winner", view: "luckyDraw", autoAdvance: true } });
  item.save = vi.fn(async () => item) as any;
  await updatePresentationState(item, { view: "checkin", autoAdvanceDelay: 15 });
  const restored = new MeetingModel(item.toObject());
  expect(restored.presentation).toMatchObject({ view: "checkin", autoAdvance: true, autoAdvanceDelay: 15, drawWinnerId: "winner" });
  expect(restored.presentation?.drawWinnerId).toBe("winner");
});
it("switches the shared view on speaker start without resetting a running timer", async () => {
  const item = meeting(); item.presentation.view = "checkin";
  await startMeetingPresentation(item, "first", new Date(+origin + 5000));
  expect(item.presentation.view).toBe("speaker");
  expect(+item.speakerStartedAt).toBe(+origin);
});
it("saves one shared draw result and reveal timestamp in the same write", async () => {
  const item = meeting();
  item.luckyDraw = { drawMode: "attendees", allowRepeatWinners: false, prizes: [{ id: "prize", name: "Gift", quantity: 2, winners: [] }] };
  const result = await spinLuckyDraw(item, "prize", "organizer", true);
  expect(item.save).toHaveBeenCalledTimes(1);
  expect(item.presentation.view).toBe("luckyDraw");
  expect(item.presentation.drawWinnerId).toBe(result.winner.id);
  expect(+item.presentation.drawRevealsAt - +item.presentation.drawStartedAt).toBe(5000);
  expect(item.luckyDraw.prizes[0].winners).toHaveLength(1);
});
it("rejects malformed states and prevents clients from setting draw results", () => {
  for (const body of [{ view: "speaker" }, { version: 0 }, { version: 0, view: "anything" }, { version: 0, autoAdvanceDelay: -1 }, { version: 0, autoAdvanceDelay: 3601 }, { version: 0, view: "luckyDraw", drawWinnerId: "chosen-by-client" }]) {
    expect(presentationStateInput.validate(body).error).toBeDefined();
  }
  expect(presentationStateInput.validate({ version: 0, view: "speaker", autoAdvance: true, autoAdvanceDelay: 0 }).error).toBeUndefined();
});
