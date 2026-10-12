export function chapterDisplayName(name: string): string {
  return /^(?:BNI Chapter|Chapter BNI)$/i.test(name.trim()) ? "Chapter" : name;
}

export function chapterNameForCode(code: string, name?: string): string {
  return chapterDisplayName(name || `Chapter ${code}`);
}
