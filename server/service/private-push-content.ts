// System banners can appear on a locked device. Detailed content stays in the
// authenticated app, including names, room titles, message text and fee amounts.
export function privatePushContent(chat = false) {
  return {
    title: "iGen Connect",
    body: chat ? "Bạn có tin nhắn mới. Mở ứng dụng để xem." : "Bạn có thông báo mới. Mở ứng dụng để xem.",
  };
}
