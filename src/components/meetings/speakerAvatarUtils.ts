export const AVATAR_PALETTES = [
  { bg: "bg-cyan-50", text: "text-cyan-700", border: "border-cyan-200/80" },
  { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200/80" },
  { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200/80" },
  { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200/80" },
  { bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-200/80" },
  { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200/80" },
  { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200/80" },
  { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200/80" },
];

export function getAvatarColor(name: string) {
  if (!name) return AVATAR_PALETTES[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[index];
}

export function getAvatarInitial(name: string): string {
  const trimmed = (name || "").trim();
  if (!trimmed) return "?";
  return trimmed.slice(0, 1).toUpperCase();
}

const failedImageUrls = new Set<string>();

export function markImageUrlFailed(url: string) {
  if (url) failedImageUrls.add(url.trim());
}

export function isImageUrlFailed(url?: string): boolean {
  if (!url) return true;
  const trimmed = url.trim();
  if (!trimmed || trimmed === "null" || trimmed === "undefined" || trimmed === "false") return true;
  return failedImageUrls.has(trimmed);
}
