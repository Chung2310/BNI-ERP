export function entityId(value: unknown): string {
  if (value && typeof value === "object") {
    if ("_id" in value && value._id) return String(value._id);
    if ("id" in value && value.id) return String(value.id);
    if ("uid" in value && value.uid) return String(value.uid);
  }
  return String(value ?? "");
}
