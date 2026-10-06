import { afterEach, expect, it, vi } from "vitest";
vi.mock("../../socket", () => ({ emitToCompany: vi.fn() }));
import { bulkUpdateMeetingSeries } from "./meeting.service";
import { MeetingModel } from "./meeting.model";
import { bulkUpdateMeetingSeriesInput } from "./meeting.validation";

afterEach(() => vi.restoreAllMocks());

it("validates GPS coordinates as a pair for bulk updates", () => {
  const meetingIds = ["507f1f77bcf86cd799439011"];
  expect(bulkUpdateMeetingSeriesInput.validate({ meetingIds, changes: { latitude: 10, longitude: 106, gpsRadiusMeters: 350 } }).error).toBeUndefined();
  expect(bulkUpdateMeetingSeriesInput.validate({ meetingIds, changes: { latitude: null, longitude: null } }).error).toBeUndefined();
  expect(bulkUpdateMeetingSeriesInput.validate({ meetingIds, changes: { latitude: 10 } }).error).toBeDefined();
});

it("writes GPS changes to every selected meeting and invalidates its old QR", async () => {
  const anchor = { _id: "anchor", companyCode: "BNI", seriesId: "series" };
  const selected = [{ _id: "meeting-1", companyCode: "BNI", seriesId: "series", status: "scheduled", startsAt: new Date("2099-01-02T00:00:00.000Z"), __v: 3 }];
  vi.spyOn(MeetingModel, "findOne").mockResolvedValue(anchor as never);
  vi.spyOn(MeetingModel, "find").mockReturnValue({ lean: vi.fn().mockResolvedValue(selected) } as never);
  const bulkWrite = vi.spyOn(MeetingModel, "bulkWrite").mockResolvedValue({ matchedCount: 1, modifiedCount: 1 } as never);

  await bulkUpdateMeetingSeries("BNI", "anchor", {
    meetingIds: ["meeting-1"],
    changes: { latitude: 10.75, longitude: 106.5, gpsRadiusMeters: 350 },
  });

  expect(bulkWrite).toHaveBeenCalledWith([expect.objectContaining({
    updateOne: expect.objectContaining({
      update: expect.objectContaining({
        $set: expect.objectContaining({ latitude: 10.75, longitude: 106.5, gpsRadiusMeters: 350 }),
        $unset: { checkInQrTokenHash: 1, checkInQrTokenEncrypted: 1, checkInQrExpiresAt: 1 },
      }),
    }),
  })], { ordered: true });
});
