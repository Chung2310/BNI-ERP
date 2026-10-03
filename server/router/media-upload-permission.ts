export function permissionForMediaUpload(sourceType: unknown): string {
  const normalized = String(sourceType || "").trim().toLowerCase();
  if (normalized === "chat.attachment") return "chat:read";
  if (normalized === "hr.kanban") return "work:manage";
  if (
    normalized === "profile.avatar" ||
    normalized === "profile.cover" ||
    normalized === "settings.profile"
  ) {
    return "access:read";
  }
  return "resource:manage";
}
