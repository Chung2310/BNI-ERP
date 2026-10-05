import { afterEach, expect, it, vi } from "vitest";
import { MeetingModel } from "./meeting.model";
import { MeetingSequenceModel, reserveMeetingNumbers } from "./meeting-sequence";

afterEach(() => vi.restoreAllMocks());

it("seeds from the highest existing chapter number within the company", async () => {
  vi.spyOn(MeetingSequenceModel, "exists").mockResolvedValue(null);
  const find = vi.spyOn(MeetingModel, "find").mockReturnValue({ select: () => ({ lean: async () => [{ title: "BNI Chapter #9" }, { title: "BNI Chapter #12" }] }) } as any);
  const initialize = vi.spyOn(MeetingSequenceModel, "updateOne").mockResolvedValue({} as any);
  const increment = vi.spyOn(MeetingSequenceModel, "findOneAndUpdate").mockResolvedValue({ value: 16 } as any);
  expect(await reserveMeetingNumbers("COMPANY-A", 4)).toBe(13);
  expect(find).toHaveBeenCalledWith({ companyCode: "COMPANY-A", title: /^BNI Chapter #[1-9]\d*$/ });
  expect(initialize).toHaveBeenCalledWith({ _id: "COMPANY-A" }, { $setOnInsert: { value: 12 } }, { upsert: true });
  expect(increment).toHaveBeenCalledWith({ _id: "COMPANY-A" }, { $inc: { value: 4 } }, { new: true });
});

it("continues the persisted counter without recounting renamed or deleted meetings", async () => {
  vi.spyOn(MeetingSequenceModel, "exists").mockResolvedValue({ _id: "COMPANY-A" } as any);
  const find = vi.spyOn(MeetingModel, "find");
  vi.spyOn(MeetingSequenceModel, "findOneAndUpdate").mockResolvedValue({ value: 30 } as any);
  expect(await reserveMeetingNumbers("COMPANY-A", 4)).toBe(27);
  expect(find).not.toHaveBeenCalled();
});

it("handles simultaneous first-time initialization without resetting the winning counter", async () => {
  vi.spyOn(MeetingSequenceModel, "exists").mockResolvedValue(null);
  vi.spyOn(MeetingModel, "find").mockReturnValue({ select: () => ({ lean: async () => [] }) } as any);
  vi.spyOn(MeetingSequenceModel, "updateOne").mockRejectedValue({ code: 11000 });
  vi.spyOn(MeetingSequenceModel, "findOneAndUpdate").mockResolvedValue({ value: 8 } as any);
  expect(await reserveMeetingNumbers("COMPANY-A", 4)).toBe(5);
});
