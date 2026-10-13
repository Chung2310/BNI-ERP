import { afterEach, expect, it, vi } from "vitest";
import { NotificationModel } from "../model/notification.model";
import { notificationService } from "./notification.service";

const dependencies = vi.hoisted(() => ({ emitToUser: vi.fn(), sendToUser: vi.fn() }));
vi.mock("../socket", () => ({ emitToUser: dependencies.emitToUser }));
vi.mock("./mobile-push.service", () => ({ mobilePushService: { sendToUser: dependencies.sendToUser } }));
afterEach(() => vi.restoreAllMocks());

it("emits realtime and mobile push after persisting a notification", async () => {
  vi.spyOn(NotificationModel.prototype, "save").mockResolvedValue(undefined as never);
  dependencies.sendToUser.mockResolvedValue(undefined);

  const notification = await notificationService.createNotification({
    title: "Thông báo mới",
    body: "Nội dung",
    type: "he-thong",
    companyCode: "ACME",
    recipientUid: "member",
    read: false,
  });

  expect(dependencies.emitToUser).toHaveBeenCalledWith(
    "member",
    "new_notification",
    expect.objectContaining({ title: "Thông báo mới" }),
  );
  expect(dependencies.sendToUser).toHaveBeenCalledWith("member", expect.objectContaining({
    title: "Thông báo mới",
    notificationId: notification._id.toString(),
  }));
});

it("marks only the signed-in recipient's notification as read", async () => {
  const notification = { read: true };
  const update = vi.spyOn(NotificationModel, "findOneAndUpdate").mockResolvedValue(notification as never);
  expect(await notificationService.markAsRead("notice", "member")).toBe(notification);
  expect(update).toHaveBeenCalledWith(
    { _id: "notice", recipientUid: "member" }, { read: true }, { returnDocument: "after" },
  );
});

it("rejects reading or deleting another recipient's notification", async () => {
  vi.spyOn(NotificationModel, "findOneAndUpdate").mockResolvedValue(null);
  vi.spyOn(NotificationModel, "findOneAndDelete").mockResolvedValue(null);
  await expect(notificationService.markAsRead("foreign-notice", "member")).rejects.toThrow("Không tìm thấy");
  await expect(notificationService.deleteNotification("foreign-notice", "member")).rejects.toThrow("Không tìm thấy");
});

it("deletes only the signed-in recipient's notification", async () => {
  const notification = { _id: "notice" };
  const remove = vi.spyOn(NotificationModel, "findOneAndDelete").mockResolvedValue(notification as never);
  expect(await notificationService.deleteNotification("notice", "member")).toBe(notification);
  expect(remove).toHaveBeenCalledWith({ _id: "notice", recipientUid: "member" });
});

it("marks all as read only within the signed-in recipient and company", async () => {
  const update = vi.spyOn(NotificationModel, "updateMany").mockResolvedValue({} as never);
  await notificationService.markAllAsRead("member", "ACME");
  expect(update).toHaveBeenCalledWith(
    { recipientUid: "member", companyCode: "ACME", read: false }, { read: true },
  );
});
