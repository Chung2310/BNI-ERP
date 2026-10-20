export function permissionForMediaUpload(sourceType: unknown, folder?: unknown): string | string[] {
  const normalized = String(sourceType || "").trim().toLowerCase();
  // Meeting covers use the legacy direct Cloudinary upload path (no sourceType).
  // Keep this narrow to the exact folder sent by the mobile meeting form.
  if (!normalized && String(folder || "").trim() === "igen_erp/meetings") {
    return ["meetings:manage", "access:manage"];
  }
  if (normalized === "chat.attachment") return "chat:read";
  if (normalized === "hr.kanban") return "work:manage";
  if (
    normalized === "profile.avatar" ||
    normalized === "profile.cover" ||
    normalized === "profile.gallery" ||
    normalized === "settings.profile"
  ) {
    return "access:read";
  }
  return "resource:manage";
}
