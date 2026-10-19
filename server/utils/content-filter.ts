const prohibitedPhrases = [
  "kill yourself",
  "go kill yourself",
  "end your life",
  "i will kill you",
  "i ll kill you",
  "rape you",
  "i will rape you",
  "child porn",
  "child pornography",
  "tao se giet may",
  "giet ca nha may",
  "hiep dam",
  "khieu dam tre em",
  "au dam",
  "dit me",
  "dit con me",
  "du ma",
  "vai lon",
  "khon nan",
  "fuck",
  "fucking",
  "motherfucker",
  "shit",
  "bullshit",
  "bitch",
  "cunt",
  "asshole",
  "whore",
  "slut",
  "bastard",
] as const;

// Match spacing or punctuation inserted between letters, while keeping word boundaries.
const prohibitedPatterns = prohibitedPhrases.map((phrase) => {
  const flexibleWords = phrase
    .split(/\s+/)
    .map((word) => word.split("").join("[\\s._-]*"))
    .join("\\s+");
  return new RegExp("\\b" + flexibleWords + "\\b", "u");
});

export function assertSafeContentText(content: string) {
  const text = content
    .normalize("NFKD")
    .replace(/[\u0300-\u036f\u200b-\u200f\ufeff]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (prohibitedPatterns.some((pattern) => pattern.test(text))) {
    throw Object.assign(
      new Error("Nội dung vi phạm quy tắc cộng đồng. Vui lòng sửa trước khi gửi."),
      { statusCode: 400 },
    );
  }
}
