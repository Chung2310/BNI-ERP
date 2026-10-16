import { afterEach, expect, it, vi } from "vitest";
vi.mock("../../socket", () => ({ emitToCompany: vi.fn() }));
import { MeetingModel } from "./meeting.model";
import { deleteMeetings } from "./meeting.service";
import { emitToCompany } from "../../socket";

afterEach(() => vi.restoreAllMocks());

const ids = ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"];

it("deletes only selected meetings in the active company and emits one update", async () => {
  const count = vi.spyOn(MeetingModel, "countDocuments").mockResolvedValue(2 as never);
  const remove = vi.spyOn(MeetingModel, "deleteMany").mockResolvedValue({ acknowledged: true, deletedCount: 2 } as never);
  await expect(deleteMeetings("BNI", ids)).resolves.toEqual({ deletedCount: 2 });
  const filter = { _id: { $in: ids }, companyCode: "BNI" };
  expect(count).toHaveBeenCalledWith(filter);
  expect(remove).toHaveBeenCalledWith(filter);
  expect(emitToCompany).toHaveBeenCalledWith("BNI", "meeting_updated", { deleted: true });
});

it("rejects a stale or foreign meeting selection before deleting", async () => {
  vi.spyOn(MeetingModel, "countDocuments").mockResolvedValue(1 as never);
  const remove = vi.spyOn(MeetingModel, "deleteMany");
  await expect(deleteMeetings("BNI", ids)).rejects.toMatchObject({ status: 409 });
  expect(remove).not.toHaveBeenCalled();
});
