import { afterEach, expect, it, vi } from "vitest";
vi.mock("../../socket", () => ({ emitToCompany: vi.fn() }));
import * as service from "./meeting.service";
import type { MeetingDocument } from "./meeting.service";
import { MeetingModel } from "./meeting.model";
import { updateMeetingSlide } from "./meeting-slides.service";

afterEach(() => vi.restoreAllMocks());
function endedMeeting(): MeetingDocument {
  return { _id: "ended", companyCode: "BNI", title: "Kết quả cũ", status: "ended", __v: 2, speakers: [], luckyDraw: { prizes: [] }, gameWinners: [], save: vi.fn() } as unknown as MeetingDocument;
}

it.each([
  ["checkin", (m: MeetingDocument) => service.checkIn(m, {}, "actor", true)],
  ["presentation", (m: MeetingDocument) => service.startMeetingPresentation(m, "speaker")],
  ["control", (m: MeetingDocument) => service.controlMeeting(m, "start")],
  ["order", (m: MeetingDocument) => service.reorderMeetingSpeakers(m, [])],
  ["defer", (m: MeetingDocument) => service.deferMeetingSpeakers(m, ["speaker"])],
  ["config", (m: MeetingDocument) => service.updateLuckyDrawConfig(m, { enabled: false })],
  ["prize", (m: MeetingDocument) => service.addOrUpdatePrize(m, { name: "New" })],
  ["delete prize", (m: MeetingDocument) => service.deletePrize(m, "prize")],
  ["spin", (m: MeetingDocument) => service.spinLuckyDraw(m, "prize", "actor")],
  ["result", (m: MeetingDocument) => service.recordGameWinner(m, { id: "result", winnerId: "speaker", source: "wheel", name: "Winner", prizeName: "Prize", wonAt: new Date() }, "actor")],
  ["redraw", (m: MeetingDocument) => service.redrawPrizeWinner(m, "prize", "winner")],
  ["reset", (m: MeetingDocument) => service.resetLuckyDrawWinners(m)],
] as const)("rejects %s without changing ended meetings", async (_name, action) => {
  const item = endedMeeting();
  const original = JSON.stringify(item);
  await expect(action(item)).rejects.toMatchObject({ status: 409 });
  expect(JSON.stringify(item)).toBe(original);
  expect(item.save).not.toHaveBeenCalled();
});

it("blocks editing and changing slides while preserving read and delete access", async () => {
  const item = endedMeeting();
  vi.spyOn(MeetingModel, "findOne").mockResolvedValue(item);
  const remove = vi.spyOn(MeetingModel, "deleteOne").mockResolvedValue({ acknowledged: true, deletedCount: 1 });
  await expect(service.updateMeeting("BNI", "ended", { title: "Changed", version: 2 })).rejects.toMatchObject({ status: 409 });
  await expect(service.deleteMeeting("BNI", "ended")).resolves.toEqual({ success: true });
  await expect(updateMeetingSlide("BNI", "ended", "speaker", { version: 2, profile: null })).rejects.toMatchObject({ status: 409 });
  expect(await service.getMeeting("BNI", "ended")).toBe(item);
  expect(item.title).toBe("Kết quả cũ");
  expect(item.save).not.toHaveBeenCalled();
  expect(remove).toHaveBeenCalledWith({ _id: "ended", companyCode: "BNI" });
});
