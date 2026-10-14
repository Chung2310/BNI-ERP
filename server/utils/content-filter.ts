export function assertSafeContentText(content: string) {
  const text = content.normalize("NFKD").replace(/[\u0300-\u036f\u200b-\u200f\ufeff]/g, "").replace(/đ/g, "d").toLowerCase();
  const prohibited = [/\b(?:kill yourself|i will kill you|rape you|child porn)\b/, /\b(?:tao se giet may|giet ca nha may|hiep dam|khieu dam tre em|au dam)\b/];
  if (prohibited.some(pattern => pattern.test(text))) throw Object.assign(new Error("Nội dung vi phạm quy tắc cộng đồng. Vui lòng sửa trước khi gửi."), { statusCode: 400 });
}
