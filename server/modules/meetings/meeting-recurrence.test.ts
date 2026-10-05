import { afterEach, expect, it, vi } from "vitest";
vi.mock("../../socket", () => ({ emitToCompany: vi.fn() }));
import { recurringMeetingDates, meetingMonthRange, vietnamDateTime } from "../../../src/utils/meetingRecurrence";
import { createRecurringMeetings, updateMeeting, controlMeeting } from "./meeting.service";
import { MeetingModel } from "./meeting.model";
import { recurringMeetingInput } from "./meeting.validation";
afterEach(() => vi.restoreAllMocks());
const rule = { startDate: "2030-01-01", months: 6, weekday: 3, time: "07:00" };
const details = { title: "Họp tuần", tiers: [{ startTime: "07:00", endTime: "08:00", seconds: 30 }], fallbackSeconds:20, reminderDays:1 };
it("generates every Wednesday in six months at Vietnam time", () => {
 const dates = recurringMeetingDates(rule);
 expect(dates).toHaveLength(26);
 expect(vietnamDateTime(dates[0])).toBe("2030-01-02T07:00");
 expect(vietnamDateTime(dates.at(-1)!)).toBe("2030-06-26T07:00");
 dates.forEach((date, i) => { expect(date.getUTCDay()).toBe(3); if(i) expect(+date - +dates[i-1]).toBe(7*86400000); });
});
it("handles month ends, leap day and year rollover without local timezone dependence", () => {
 expect(recurringMeetingDates({ startDate:"2028-02-01", months:1, weekday:2, time:"00:30" }).map(vietnamDateTime)).toEqual(["2028-02-01T00:30","2028-02-08T00:30","2028-02-15T00:30","2028-02-22T00:30","2028-02-29T00:30"]);
 expect(recurringMeetingDates({ startDate:"2029-12-31", months:2, weekday:1, time:"23:30" }).at(-1)?.toISOString()).toBe("2030-02-25T16:30:00.000Z");
 expect(meetingMonthRange("2030-01")).toEqual({from:new Date("2029-12-31T17:00Z"),to:new Date("2030-01-31T17:00Z")});
});
it.each([{...rule,months:0},{...rule,months:13},{...rule,weekday:7},{...rule,startDate:"2030-02-30"},{...rule,time:"24:00"}])("rejects invalid recurrence %j", rule => expect(() => recurringMeetingDates(rule)).toThrow());
it("validates common meeting details and recurrence before creating the series", () => {
 expect(recurringMeetingInput.validate({...details,recurrence:rule}).error).toBeUndefined();
 expect(recurringMeetingInput.validate({...details,recurrence:{...rule,months:13}}).error).toBeDefined();
});
it("creates separate scoped meetings with one series identifier and per-date reminders", async () => {
 const insert = vi.spyOn(MeetingModel,"insertMany").mockImplementation((async (rows) => rows as unknown as Parameters<((value: typeof MeetingModel.insertMany) => void)>[0]));
 const rows = await createRecurringMeetings("BNI","actor",{...details,recurrence:rule});
 expect(rows).toHaveLength(26);
 const values = insert.mock.calls[0][0] as any[];
 expect(new Set(values.map(row => row.seriesId)).size).toBe(1);
 values.forEach(row => { expect(row.companyCode).toBe("BNI"); expect(row.createdBy).toBe("actor"); expect(+row.startsAt - +row.reminderAt).toBe(86400000); expect(row.originalStartsAt).toEqual(row.startsAt); });
});
it("rejects past occurrences and rolls back a failed batch only within its own series", async () => {
 const insert = vi.spyOn(MeetingModel,"insertMany").mockRejectedValue(new Error("write failed"));
 const remove = vi.spyOn(MeetingModel,"deleteMany").mockResolvedValue(({deletedCount:2} as unknown as Parameters<((value: Awaited<ReturnType<typeof MeetingModel.deleteMany>>) => void)>[0]));
 await expect(createRecurringMeetings("BNI","actor",{...details,recurrence:{...rule,startDate:"2000-01-01"}})).rejects.toThrow(/tương lai/);
 expect(insert).not.toHaveBeenCalled();
 await expect(createRecurringMeetings("BNI","actor",{...details,recurrence:rule})).rejects.toThrow("write failed");
 expect(remove).toHaveBeenCalledWith({companyCode:"BNI",seriesId:expect.any(String)});
});
function item() { return { _id:"one", companyCode:"BNI", seriesId:"series", startsAt:new Date("2030-01-02T00:00Z"), originalStartsAt:new Date("2030-01-02T00:00Z"), status:"scheduled", revision:1, __v:0, reminderDays:1, checkInQrTokenHash:"old", checkInQrTokenEncrypted:"old", checkInQrExpiresAt:new Date(), speakers:[], save:vi.fn().mockResolvedValue(undefined) }; }
it("reschedules only the selected occurrence, invalidates old reminders and QR codes", async () => {
 const meeting=item();const find=vi.spyOn(MeetingModel,"findOne").mockResolvedValue((meeting as unknown as Parameters<((value: Awaited<ReturnType<typeof MeetingModel.findOne>>) => void)>[0]));
 await updateMeeting("BNI","one",{startsAt:new Date("2030-01-03T00:00Z"),version:0});
 expect(find).toHaveBeenCalledWith({_id:"one",companyCode:"BNI"});
 expect(meeting.revision).toBe(2);expect(meeting.checkInQrTokenHash).toBeUndefined();expect(meeting.originalStartsAt.toISOString()).toBe("2030-01-02T00:00:00.000Z");
 expect(meeting.save).toHaveBeenCalledOnce();
});
it("rejects stale edits and moving a started meeting or moving into the past", async () => {
 const meeting=item();vi.spyOn(MeetingModel,"findOne").mockResolvedValue((meeting as unknown as Parameters<((value: Awaited<ReturnType<typeof MeetingModel.findOne>>) => void)>[0]));
 await expect(updateMeeting("BNI","one",{version:9,title:"edit"})).rejects.toThrow(/thay đổi/);
 await expect(updateMeeting("BNI","one",{startsAt:new Date("2000-01-01")})).rejects.toThrow(/tương lai/);
 meeting.status="live";
 await expect(updateMeeting("BNI","one",{startsAt:new Date("2030-02-01")})).rejects.toThrow();
 expect(meeting.save).not.toHaveBeenCalled();
});
it("cancels the selected scheduled occurrence without deleting its history", async () => {
 const meeting=item(); await controlMeeting((meeting as unknown as Parameters<typeof controlMeeting>[0]),"cancel");
 expect(meeting.status).toBe("cancelled");expect(meeting.seriesId).toBe("series");expect(meeting.save).toHaveBeenCalledOnce();
});
