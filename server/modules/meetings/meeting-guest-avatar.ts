export const MAX_GUEST_AVATAR_BYTES = 5 * 1024 * 1024;
export type GuestAvatarFile = { buffer: Buffer; mimetype: string; size: number };

export function guestAvatarError(file: GuestAvatarFile): string | null {
  if (!file.buffer.length || file.size !== file.buffer.length || file.size > MAX_GUEST_AVATAR_BYTES) {
    return "Ảnh đại diện phải có dung lượng từ 1 byte đến 5 MB.";
  }
  const bytes = file.buffer;
  const jpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const webp = bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  if ((file.mimetype === "image/jpeg" && jpeg) || (file.mimetype === "image/png" && png) || (file.mimetype === "image/webp" && webp)) return null;
  return "Vui lòng chọn ảnh JPG, PNG hoặc WebP hợp lệ.";
}
