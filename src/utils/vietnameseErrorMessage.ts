export const DEFAULT_ERROR_MESSAGE = "Đã xảy ra lỗi. Vui lòng thử lại.";

const VIETNAMESE = /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i;

const RULES = [
  {
    pattern: /failed to fetch|network(?: request)? (?:error|failed)|\bload failed/i,
    message: "Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng.",
  },
  {
    pattern: /unauthorized|invalid token|jwt|session.*(?:expired|invalid)/i,
    message: "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.",
  },
  {
    pattern: /forbidden|permission denied|not allowed|access denied/i,
    message: "Bạn không có quyền thực hiện thao tác này.",
  },
  {
    pattern: /upload.*failed|failed.*upload/i,
    message: "Tải tệp lên thất bại. Vui lòng thử lại.",
  },
  {
    pattern: /download.*failed|failed.*download/i,
    message: "Tải tệp xuống thất bại. Vui lòng thử lại.",
  },
  {
    pattern: /timeout|timed out/i,
    message: "Yêu cầu đã hết thời gian chờ. Vui lòng thử lại.",
  },
  { pattern: /not found/i, message: "Không tìm thấy dữ liệu yêu cầu." },
  {
    pattern: /validation|invalid|required/i,
    message: "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.",
  },
  {
    pattern: /internal server error|server error/i,
    message: "Máy chủ đang gặp sự cố. Vui lòng thử lại sau.",
  },
] as const;

const ACTION_RULES: readonly { pattern: RegExp; message: string }[] = [
  {
    pattern: /unable to print payslip/i,
    message: "Không thể in phiếu lương. Vui lòng thử lại.",
  },
  {
    pattern: /payroll export failed/i,
    message: "Không thể xuất bảng lương. Vui lòng thử lại.",
  },
  {
    pattern: /a written reason is required/i,
    message: "Vui lòng nhập lý do trước khi tiếp tục.",
  },
  {
    pattern: /deletion request code not found/i,
    message: "Không tìm thấy yêu cầu xóa dữ liệu. Vui lòng kiểm tra lại mã.",
  },
  {
    pattern: /\b(?:http\s*)?404\b|not found/i,
    message: "Không tìm thấy dữ liệu yêu cầu.",
  },
  {
    pattern: /duplicate employee code/i,
    message: "Mã nhân viên đã tồn tại. Vui lòng kiểm tra và nhập mã khác.",
  },
  {
    pattern: /upload failed\s*:|unsupported source url|cloudinary|request failed with status code/i,
    message: "Không thể tải tệp lên. Vui lòng chọn tệp khác hoặc thử lại.",
  },
  {
    pattern: /duplicate (?:key|value)|already exists|already been taken/i,
    message: "Thông tin này đã tồn tại. Vui lòng kiểm tra và nhập giá trị khác.",
  },
  {
    pattern: /invalid|required|validation failed/i,
    message: "Thông tin nhập vào chưa đúng hoặc còn thiếu. Vui lòng kiểm tra lại.",
  },
];

export function toVietnameseErrorMessage(message: unknown, fallback = DEFAULT_ERROR_MESSAGE): string {
  let text = typeof message === "string" ? message.trim() : "";
  if (!text) return fallback;
  try {
    const parsed = JSON.parse(text) as { error?: unknown; message?: unknown };
    const nested = typeof parsed?.error === "string" ? parsed.error : parsed?.message;
    if (typeof nested === "string" && nested.trim()) text = nested.trim();
  } catch {
    // The message is plain text, which is the normal case.
  }
  if (/[ÃÂÄ]/.test(text)) {
    const windows1252: Record<string, number> = {
      "\u20AC": 0x80, "\u201A": 0x82, "\u0192": 0x83, "\u201E": 0x84,
      "\u2026": 0x85, "\u2020": 0x86, "\u2021": 0x87, "\u02C6": 0x88,
      "\u2030": 0x89, "\u0160": 0x8A, "\u2039": 0x8B, "\u0152": 0x8C,
      "\u017D": 0x8E, "\u2018": 0x91, "\u2019": 0x92, "\u201C": 0x93,
      "\u201D": 0x94, "\u2022": 0x95, "\u2013": 0x96, "\u2014": 0x97,
      "\u02DC": 0x98, "\u2122": 0x99, "\u0161": 0x9A, "\u203A": 0x9B,
      "\u0153": 0x9C, "\u017E": 0x9E, "\u0178": 0x9F,
    };
    const repaired = new TextDecoder().decode(Uint8Array.from(text, (character) => windows1252[character] ?? character.charCodeAt(0)));
    if (VIETNAMESE.test(repaired)) text = repaired;
  }
  if (/không có (?:mã )?quyền|khong co (?:ma )?quyen/i.test(text)) {
    return "Bạn không có quyền thực hiện thao tác này.";
  }
  const rule = RULES.find(({ pattern }) => pattern.test(text));
  const actionRule = ACTION_RULES.find(({ pattern }) => pattern.test(text));
  if (actionRule) return actionRule.message;
  if (VIETNAMESE.test(text)) {
    return text;
  }
  if (rule && !text.includes(":")) return rule.message;
  return rule?.message || fallback;
}
