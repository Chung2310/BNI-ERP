import { afterEach, expect, it, vi } from "vitest";
vi.mock("../../socket", () => ({ emitToCompany: vi.fn() }));
import { bulkUpdateMeetingSeries, createMeeting, createRecurringMeetings, updateMeeting } from "./meeting.service";
import { MeetingModel } from "./meeting.model";
import * as sequence from "./meeting-sequence";

afterEach(() => vi.restoreAllMocks());
const details = { title: "Họp BNI", tiers: [{ startTime: "07:00", endTime: "08:00", seconds: 30 }], fallbackSeconds: 20, reminderDays: 1 };

it("rejects a single meeting whose time overlaps another meeting in the company", async () => {
  const exists = vi.spyOn(MeetingModel, "exists").mockResolvedValue({ _id: "existing" } as never);
  const create = vi.spyOn(MeetingModel, "create");
  await expect(createMeeting("BNI", "actor", { ...details, startsAt: "2030-01-02T00:00:00Z", endsAt: "2030-01-02T02:00:00Z" })).rejects.toMatchObject({ status: 409 });
  expect(create).not.toHaveBeenCalled();
  expect(exists).toHaveBeenCalledWith(expect.objectContaining({
    companyCode: "BNI",
    status: { $in: ["scheduled", "live", "paused"] },
    $or: expect.arrayContaining([
      { startsAt: { $lt: new Date("2030-01-02T02:00:00Z") }, endsAt: { $gt: new Date("2030-01-02T00:00:00Z") } },
    ]),
  }));
});

it("allows a meeting to start exactly when the previous one ends", async () => {
  vi.spyOn(MeetingModel, "exists").mockResolvedValue(null);
  const create = vi.spyOn(MeetingModel, "create").mockResolvedValue({ _id: "new" } as never);
  await createMeeting("BNI", "actor", { ...details, startsAt: "2030-01-02T02:00:00Z", endsAt: "2030-01-02T04:00:00Z" });
  expect(create).toHaveBeenCalledOnce();
});

it("rejects a recurring series before reserving numbers or inserting meetings", async () => {
  vi.spyOn(MeetingModel, "exists").mockResolvedValue({ _id: "existing" } as never);
  const reserve = vi.spyOn(sequence, "reserveMeetingNumbers");
  const insert = vi.spyOn(MeetingModel, "insertMany");
  await expect(createRecurringMeetings("BNI", "actor", { ...details, title: undefined, recurrence: { startDate: "2030-01-01", months: 1, weekday: 3, time: "07:00" } })).rejects.toMatchObject({ status: 409 });
  expect(reserve).not.toHaveBeenCalled();
  expect(insert).not.toHaveBeenCalled();
});

it("rejects rescheduling into an occupied slot while excluding the meeting itself", async () => {
  const item = { _id: "meeting-1", companyCode: "BNI", status: "scheduled", startsAt: new Date("2030-01-02T00:00:00Z"), endsAt: new Date("2030-01-02T02:00:00Z"), __v: 0, revision: 1, speakers: [], save: vi.fn() };
  vi.spyOn(MeetingModel, "findOne").mockResolvedValue(item as never);
  const exists = vi.spyOn(MeetingModel, "exists").mockResolvedValue({ _id: "another" } as never);
  await expect(updateMeeting("BNI", "meeting-1", { startsAt: "2030-01-03T00:00:00Z" })).rejects.toMatchObject({ status: 409 });
  expect(item.save).not.toHaveBeenCalled();
  expect(exists).toHaveBeenCalledWith(expect.objectContaining({ _id: { $nin: ["meeting-1"] } }));
});

it("rejects a bulk series time change that overlaps another meeting", async () => {
  vi.spyOn(MeetingModel, "findOne").mockResolvedValue({ _id: "anchor", companyCode: "BNI", seriesId: "series" } as never);
  vi.spyOn(MeetingModel, "find").mockReturnValue({ lean: vi.fn().mockResolvedValue([{ _id: "meeting-1", companyCode: "BNI", seriesId: "series", status: "scheduled", startsAt: new Date("2030-01-02T00:00:00Z"), endsAt: new Date("2030-01-02T02:00:00Z"), __v: 0 }]) } as never);
  vi.spyOn(MeetingModel, "exists").mockResolvedValue({ _id: "another" } as never);
  const write = vi.spyOn(MeetingModel, "bulkWrite");
  await expect(bulkUpdateMeetingSeries("BNI", "anchor", { meetingIds: ["meeting-1"], changes: { startsTime: "08:00" } })).rejects.toMatchObject({ status: 409 });
  expect(write).not.toHaveBeenCalled();
});
