import { afterEach, expect, it, vi } from "vitest";
vi.mock("../../socket", () => ({ emitToCompany: vi.fn() }));
import * as service from "./meeting.service";
import { MeetingModel } from "./meeting.model";
import { updateMeetingSlide } from "./meeting-slides.service";

afterEach(() => vi.restoreAllMocks());
function endedMeeting() {
  return { _id: "ended", companyCode: "BNI", title: "Kết quả cũ", status: "ended", __v: 2, speakers: [], luckyDraw: { prizes: [] }, gameWinners: [], save: vi.fn() };
}

it.each([
  ["checkin", (m: any) => service.checkIn(m, {}, "actor", true)],
  ["presentation", (m: any) => service.startMeetingPresentation(m, "speaker")],
  ["control", (m: any) => service.controlMeeting(m, "start")],
  ["order", (m: any) => service.reorderMeetingSpeakers(m, [])],
  ["defer", (m: any) => service.deferMeetingSpeakers(m, ["speaker"])],
  ["config", (m: any) => service.updateLuckyDrawConfig(m, { enabled: false })],
  ["prize", (m: any) => service.addOrUpdatePrize(m, { name: "New" })],
  ["delete prize", (m: any) => service.deletePrize(m, "prize")],
  ["spin", (m: any) => service.spinLuckyDraw(m, "prize", "actor")],
  ["result", (m: any) => service.recordGameWinner(m, { id: "result" }, "actor")],
  ["redraw", (m: any) => service.redrawPrizeWinner(m, "prize", "winner")],
  ["reset", (m: any) => service.resetLuckyDrawWinners(m)],
] as const)("rejects %s without changing ended meetings", async (_name, action) => {
  const item = endedMeeting();
  const original = JSON.stringify(item);
  await expect(action(item)).rejects.toMatchObject({ status: 409 });
  expect(JSON.stringify(item)).toBe(original);
  expect(item.save).not.toHaveBeenCalled();
});

it("blocks editing, deleting and changing slides while preserving read access", async () => {
  const item = endedMeeting();
  vi.spyOn(MeetingModel, "findOne").mockResolvedValue(item as any);
  const remove = vi.spyOn(MeetingModel, "deleteOne");
  await expect(service.updateMeeting("BNI", "ended", { title: "Changed", version: 2 })).rejects.toMatchObject({ status: 409 });
  await expect(service.deleteMeeting("BNI", "ended")).rejects.toMatchObject({ status: 409 });
  await expect(updateMeetingSlide("BNI", "ended", "speaker", { version: 2, profile: null })).rejects.toMatchObject({ status: 409 });
  expect(await service.getMeeting("BNI", "ended")).toBe(item);
  expect(item.title).toBe("Kết quả cũ");
  expect(item.save).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
});
