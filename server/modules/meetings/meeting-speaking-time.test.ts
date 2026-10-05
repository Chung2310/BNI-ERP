import { afterEach, expect, it, vi } from "vitest";
vi.mock("../../socket", () => ({ emitToCompany: vi.fn() }));
import { defaultSpeakingTimeSlots, validateSpeakingTimeSlots } from "../../../src/utils/meetingSpeakingTime";
import { speakingSeconds, allocateSpeakers } from "./meeting.rules";
import { MeetingModel } from "./meeting.model";
import { UserModel } from "../../model/user.model";
import { meetingInput, updateMeetingInput, recurringMeetingInput } from "./meeting.validation";
import { autoStartDueMeetings, checkIn, checkInFromModule, controlMeeting, startMeetingPresentation, updateMeeting } from "./meeting.service";

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
const slots = defaultSpeakingTimeSlots();

it.each([
  ["2030-01-01T23:59:59.999Z", 15],
  ["2030-01-02T00:00:00.000Z", 30],
  ["2030-01-02T00:59:59.999Z", 30],
  ["2030-01-02T01:00:00.000Z", 20],
  ["2030-01-02T01:59:59.999Z", 20],
  ["2030-01-02T02:00:00.000Z", 15],
  ["2030-01-03T07:30:00+07:00", 30],
  ["invalid", 15],
])("allocates %s by Vietnam check-in time to %s seconds", (at, expected) => {
  expect(speakingSeconds(at, slots, 15, 999)).toBe(expected);
});

it("uses a person's own check-in time after the speaking queue is reordered", () => {
  const people = [
    { id: "late", name: "Late", checkedInAt: "2030-01-02T01:30:00Z", seconds: 0 },
    { id: "early", name: "Early", checkedInAt: "2030-01-02T00:15:00Z", seconds: 0 },
    { id: "also-early", name: "Also early", checkedInAt: "2030-01-02T00:45:00Z", seconds: 0 },
  ];
  const allocated = allocateSpeakers(people, slots, 15);
  expect(allocated.map(person => person.id)).toEqual(people.map(person => person.id));
  expect(allocated.map(person => person.seconds)).toEqual([20, 30, 30]);
  expect(people.map(person => person.seconds)).toEqual([0, 0, 0]);
});

it.each([
  [{ startTime: "07:00", endTime: "08:01", seconds: 30 }, slots[1]],
  [slots[0], { startTime: "07:15", endTime: "07:45", seconds: 20 }],
  [slots[0], slots[0]],
  [{ startTime: "08:00", endTime: "07:00", seconds: 30 }],
  [{ startTime: "08:00", endTime: "08:00", seconds: 30 }],
  [{ startTime: "24:00", endTime: "25:00", seconds: 30 }],
  [{ startTime: "07:00", endTime: "08:00", seconds: 0 }],
  [{ startTime: "07:00", endTime: "08:00", seconds: 1.5 }],
].map(tiers => ({ tiers })))("rejects invalid speaking slots $tiers", ({ tiers }) => {
  expect(validateSpeakingTimeSlots(tiers)).not.toBe("");
  expect(updateMeetingInput.validate({ tiers }).error).toBeDefined();
});

it("accepts adjacent or disjoint slots in any order across single, recurring and edit inputs", () => {
  const tiers = [slots[1], slots[0], { startTime: "10:00", endTime: "11:00", seconds: 45 }];
  const details = { title: "Họp", tiers, fallbackSeconds: 15 };
  expect(validateSpeakingTimeSlots(tiers)).toBe("");
  expect(meetingInput.validate({ ...details, startsAt: "2030-01-02T00:00:00Z" }).error).toBeUndefined();
  expect(updateMeetingInput.validate({ tiers }).error).toBeUndefined();
  expect(recurringMeetingInput.validate({ ...details, recurrence: { startDate: "2030-01-01", months: 6, weekday: 3, time: "07:00" } }).error).toBeUndefined();
  expect(updateMeetingInput.validate({ tiers: [{ count: 10, seconds: 30 }] }).error).toBeDefined();
  expect(speakingSeconds("2030-01-02T02:30:00Z", tiers, 15)).toBe(15);
});

function meeting() {
  const item = new MeetingModel({
    _id: "507f1f77bcf86cd799439011", companyCode: "BNI", title: "Họp",
    startsAt: new Date("2030-01-02T00:00:00Z"), reminderAt: new Date("2030-01-01T00:00:00Z"),
    latitude: 10, longitude: 106, gpsRadiusMeters: 200, tiers: slots, fallbackSeconds: 15,
    speakers: [
      { id: "late", name: "Late", checkedInAt: new Date("2030-01-02T01:30:00Z"), seconds: 1 },
      { id: "early", name: "Early", checkedInAt: new Date("2030-01-02T00:30:00Z"), seconds: 1 },
    ],
  });
  vi.spyOn(item, "save").mockResolvedValue(item);
  return item;
}

it("stores time slots through Mongoose serialization and supplies them by default", () => {
  const item = meeting();
  expect(item.toObject().tiers).toEqual(slots);
  expect(new MeetingModel(item.toObject()).toObject().tiers).toEqual(slots);
  expect(new MeetingModel().toObject().tiers).toEqual(slots);
});

it.each(["manual", "automatic", "presentation"])("recalculates checked-in people by timestamp on %s start", async mode => {
  const item = meeting();
  const now = new Date("2030-01-02T02:00:00Z");
  if (mode === "manual") await controlMeeting(item, "start", now);
  else if (mode === "automatic") {
    vi.spyOn(MeetingModel, "find").mockResolvedValue([item]);
    await autoStartDueMeetings(now);
  } else await startMeetingPresentation(item, "early", now);
  expect(item.speakers.map(person => person.id)).toEqual(["late", "early"]);
  expect(item.speakers.map(person => person.seconds)).toEqual([20, 30]);
});

it("saving a scheduled meeting recalculates existing arrivals with the new slots", async () => {
  const item = meeting();
  vi.spyOn(MeetingModel, "findOne").mockResolvedValue(item);
  const tiers = [{ startTime: "07:00", endTime: "08:00", seconds: 45 }];
  await updateMeeting("BNI", String(item._id), { tiers, fallbackSeconds: 10 });
  expect(item.toObject().tiers).toEqual(tiers);
  expect(item.speakers.map(person => person.seconds)).toEqual([10, 45]);
  expect(item.save).toHaveBeenCalledOnce();
});

it("uses the same server timestamp for guests and members, regardless of attendee count", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2030-01-02T00:30:00Z"));
  const item = meeting();
  item.set("speakers", []);
  for (let index = 0; index < 12; index++) {
    await checkIn(item, (({ name: "Guest " + index, checkedInAt: "2030-01-02T01:30:00Z" }) as unknown as Parameters<typeof checkIn>[1]), "admin", true);
  }
  expect(item.speakers.map(person => person.seconds)).toEqual(Array(12).fill(30));
  expect(item.speakers.every(person => person.checkedInAt?.toISOString() === "2030-01-02T00:30:00.000Z")).toBe(true);
  vi.spyOn(UserModel, "findOne").mockReturnValue({ select: () => ({ lean: async () => ({ displayName: "Member", email: "member@test.com" }) }) } as unknown as ReturnType<typeof UserModel.findOne>);
  await checkInFromModule(item, { latitude: 10, longitude: 106 }, "member", false);
  vi.setSystemTime(new Date("2030-01-02T01:00:00Z"));
  await checkInFromModule(item, { latitude: 10, longitude: 106 }, "member", false);
  expect(item.speakers.filter(person => person.userId === "member")).toHaveLength(1);
  expect(item.speakers.at(-1)?.seconds).toBe(30);
  await checkIn(item, { name: "Guest at eight" }, "admin", true);
  expect(item.speakers.at(-1)?.seconds).toBe(20);
});
