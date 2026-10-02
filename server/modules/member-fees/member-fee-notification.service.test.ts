import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ create: vi.fn(), notify: vi.fn() }));
vi.mock("./member-fee.service", () => ({ createMemberFees: mocks.create }));
vi.mock("./sepay.service", () => ({ notifyFee: mocks.notify }));
import { createAndNotifyMemberFees } from "./member-fee-notification.service";
beforeEach(() => { vi.clearAllMocks(); mocks.notify.mockResolvedValue({}); });
it("sends immediately and only for newly inserted fees", async () => {
  mocks.create.mockResolvedValue({ created: 2, skipped: 1, createdIds: ["new-a", "new-b"] });
  const input = { memberIds: ["a", "b", "c"] };
  const result = await createAndNotifyMemberFees("A", "admin", input);
  expect(mocks.create).toHaveBeenCalledWith("A", "admin", input, true);
  expect(mocks.notify).toHaveBeenCalledTimes(2);
  expect(mocks.notify).toHaveBeenCalledWith("A", "new-a");
  expect(mocks.notify).toHaveBeenCalledWith("A", "new-b");
  expect(result).toEqual({ created: 2, skipped: 1, notified: 2, notificationFailures: [] });
});
it("retains created fees and reports delivery failures while continuing other recipients", async () => {
  mocks.create.mockResolvedValue({ created: 2, skipped: 0, createdIds: ["fail", "ok"] });
  mocks.notify.mockImplementation(async (_company, id) => { if (id === "fail") throw new Error("SMTP chưa cấu hình"); });
  const result = await createAndNotifyMemberFees("A", "admin", {});
  expect(result).toEqual({ created: 2, skipped: 0, notified: 1, notificationFailures: [{ feeId: "fail", message: "SMTP chưa cấu hình" }] });
});
it("does not send again for a repeated create request", async () => {
  mocks.create.mockResolvedValue({ created: 0, skipped: 2, createdIds: [] });
  await createAndNotifyMemberFees("A", "admin", {});
  expect(mocks.notify).not.toHaveBeenCalled();
});
it("does not send when fee creation fails", async () => {
  mocks.create.mockRejectedValueOnce(new Error("Thành viên không hợp lệ"));
  await expect(createAndNotifyMemberFees("A", "admin", {})).rejects.toThrow("Thành viên không hợp lệ");
  expect(mocks.notify).not.toHaveBeenCalled();
});
