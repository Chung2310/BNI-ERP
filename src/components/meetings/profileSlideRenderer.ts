import type { ProfileSlide } from "./slideTypes";
import "@fontsource/noto-sans/400.css";
import "@fontsource/noto-sans/700.css";
import "@fontsource/noto-sans/800.css";

export const SLIDE_WIDTH = 1920;
export const SLIDE_HEIGHT = 1080;
const RED = "#d70b2d";
const images = new Map<string, Promise<HTMLImageElement | null>>();

export function loadSlideImage(url: string): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  if (images.has(url)) return images.get(url)!;
  const promise = new Promise<HTMLImageElement | null>(resolve => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const finish = (value: HTMLImageElement | null) => {
      window.clearTimeout(timer);
      img.onload = img.onerror = null;
      if (!value) images.delete(url);
      resolve(value);
    };
    const timer = window.setTimeout(() => finish(null), 8000);
    img.onload = () => finish(img);
    img.onerror = () => finish(null);
    img.src = url;
  });
  // Keep a bounded cache for long attendee lists.
  if (images.size >= 80) images.delete(images.keys().next().value!);
  images.set(url, promise);
  return promise;
}

function font(ctx: CanvasRenderingContext2D, size: number, weight = 400) {
  ctx.font = `${weight} ${size}px "Noto Sans", sans-serif`;
}

export function wrapSlideText(ctx: Pick<CanvasRenderingContext2D, "measureText">, value: string, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of value.split(/\r?\n/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width <= width) { line = candidate; continue; }
      if (line) { lines.push(line); line = ""; }
      // Long unbroken names/URLs must still stay inside their box.
      for (const char of Array.from(word)) {
        if (line && ctx.measureText(line + char).width > width) { lines.push(line); line = ""; }
        line += char;
      }
    }
    lines.push(line);
  }
  return lines;
}

function textBox(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, width: number, maxLines: number, size: number, minSize: number, color: string, weight = 400) {
  let lines: string[] = [];
  let chosen = size;
  for (; chosen >= minSize; chosen -= 1) {
    font(ctx, chosen, weight);
    lines = wrapSlideText(ctx, value, width);
    if (lines.length <= maxLines) break;
  }
  chosen = Math.max(chosen, minSize);
  font(ctx, chosen, weight);
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    let last = lines[maxLines - 1];
    while (last && ctx.measureText(last + "…").width > width) last = last.slice(0, -1);
    lines[maxLines - 1] = last + "…";
  }
  ctx.fillStyle = color;
  lines.forEach((line, i) => ctx.fillText(line, x, y + i * chosen * 1.35));
}

function cover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, top = false) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / scale, sh = h / scale;
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, top ? (img.naturalHeight - sh) * 0.25 : (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
}

export async function renderProfileSlide(slide: ProfileSlide): Promise<{ canvas: HTMLCanvasElement; warnings: string[] }> {
  const member = slide.kind === "member";
  const [template, avatar, banner] = await Promise.all([
    loadSlideImage("/bni-logo.png"),
    loadSlideImage(slide.photoURL),
    loadSlideImage(slide.coverImage),
    document.fonts.load('400 32px "Noto Sans"', "Nguyễn Đặng Trần Quốc Việt"),
    document.fonts.load('700 32px "Noto Sans"', "Nguyễn Đặng Trần Quốc Việt"),
    document.fonts.load('800 32px "Noto Sans"', "Nguyễn Đặng Trần Quốc Việt"),
  ]);
  const canvas = document.createElement("canvas");
  canvas.width = SLIDE_WIDTH; canvas.height = SLIDE_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Trình duyệt không hỗ trợ xuất slide.");
  ctx.textBaseline = "top";
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, 1920, 1080);
  ctx.fillStyle = RED; ctx.fillRect(0, 0, 1920, 17); ctx.fillRect(0, 1038, 1920, 42);
  // Preserve the supplied BNI mark without baking the placeholder text into the slide.
  if (template) {
    const logoWidth = 200;
    ctx.drawImage(template, 70, 45, logoWidth, logoWidth * template.naturalHeight / template.naturalWidth);
  } else textBox(ctx, "BNI", 70, 40, 240, 1, 95, 95, RED, 800);
  ctx.textAlign = "right"; font(ctx, 30, 800); ctx.fillStyle = "#555";
  ctx.fillText(member ? "BNI MEMBER PROFILE" : "BNI GUEST PROFILE", 1850, 65);
  ctx.textAlign = "left"; ctx.fillStyle = "#e2e2e2"; ctx.fillRect(60, 150, 1800, 7);

  const bannerY = 180, bannerH = member ? 310 : 185;
  ctx.fillStyle = "#eeeeee"; ctx.fillRect(60, bannerY, 1800, bannerH);
  if (banner) cover(ctx, banner, 60, bannerY, 1800, bannerH);
  else {
    const gradient = ctx.createLinearGradient(60, bannerY, 1860, bannerY + bannerH);
    gradient.addColorStop(0, "#f5f5f5"); gradient.addColorStop(1, "#e7e7e7");
    ctx.fillStyle = gradient; ctx.fillRect(60, bannerY, 1800, bannerH);
    ctx.fillStyle = RED; ctx.beginPath(); ctx.moveTo(1600, bannerY); ctx.lineTo(1860, bannerY + bannerH); ctx.lineTo(1600, bannerY + bannerH); ctx.fill();
  }

  const cy = member ? 550 : 500;
  ctx.save(); ctx.shadowColor = "#00000026"; ctx.shadowBlur = 12; ctx.shadowOffsetY = 4;
  ctx.beginPath(); ctx.arc(255, cy, 170, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill(); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.arc(255, cy, 156, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = "#e9e9e9"; ctx.fillRect(99, cy - 156, 312, 312);
  if (avatar) cover(ctx, avatar, 99, cy - 156, 312, 312, true);
  else {
    const initials = slide.name.trim().split(/\s+/).slice(-2).map(s => Array.from(s)[0] || "").join("").toUpperCase();
    ctx.textAlign = "center"; font(ctx, 85, 700); ctx.fillStyle = "#9b9b9b"; ctx.fillText(initials || "BNI", 255, cy - 58);
  }
  ctx.restore();
  const badgeY = member ? 455 : 355;
  ctx.fillStyle = RED; ctx.beginPath(); ctx.roundRect(480, badgeY, 280, 58, 8); ctx.fill();
  ctx.fillStyle = "#fff"; font(ctx, 25, 800); ctx.fillText(member ? "THÀNH VIÊN BNI" : "KHÁCH MỜI", 503, badgeY + 12);
  const nameY = member ? 532 : 441;
  textBox(ctx, slide.name.toLocaleUpperCase("vi-VN"), 480, nameY, 1380, 1, 62, 33, "#242424", 800);
  textBox(ctx, slide.company || "Chưa cập nhật công ty", 480, nameY + 79, 1380, 1, 37, 25, RED, 700);

  const cardsY = member ? 671 : 601;
  function card(x: number, label: string, value: string) {
    ctx.fillStyle = "#f5f5f5"; ctx.strokeStyle = "#dddddd"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(x, cardsY, 670, 135, 18); ctx.fill(); ctx.stroke();
    textBox(ctx, label, x + 30, cardsY + 22, 610, 1, 23, 23, "#858585", 700);
    textBox(ctx, value, x + 30, cardsY + 65, 610, 1, 37, 23, "#252525", 700);
  }
  if (member) {
    card(480, "SỐ ĐIỆN THOẠI", slide.phone || "Chưa cập nhật");
    card(1190, "LOẠI HÌNH DỊCH VỤ", slide.industry || "Chưa cập nhật");
  }
  const bioY = member ? 843 : 635;
  textBox(ctx, "BIO / GIỚI THIỆU NGẮN", 480, bioY, 1380, 1, 30, 30, RED, 700);
  textBox(ctx, slide.bio || "Chưa có giới thiệu ngắn.", 480, bioY + 50, 1380, member ? 3 : 4, 30, 25, "#646464");
  textBox(ctx, member ? "THÀNH VIÊN BNI" : "KHÁCH MỜI BNI", 65, 993, 380, 1, 18, 18, "#888", 700);
  const warnings: string[] = [];
  if (slide.photoURL && !avatar) warnings.push("Không tải được ảnh đại diện (đường dẫn hoặc quyền truy cập ảnh).");
  if (slide.coverImage && !banner) warnings.push("Không tải được ảnh bìa (đường dẫn hoặc quyền truy cập ảnh).");
  if (!template) warnings.push("Không tải được logo từ ảnh mẫu.");
  return { canvas, warnings };
}
