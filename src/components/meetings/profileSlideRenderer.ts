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
  return lines.length * chosen * 1.35;
}

function cover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, top = false) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / scale, sh = h / scale;
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, top ? (img.naturalHeight - sh) * 0.25 : (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
}

// Decorative assets extracted from the supplied PowerPoint, without sample profile data.
const ASSETS = ["background.jpeg", "portrait-frame.png", "bni.png", "footer-white.svg", "footer-red.svg", "swoosh.png"];

function pill(ctx: CanvasRenderingContext2D, label: string, x: number, y: number, width: number) {
  ctx.fillStyle = RED;
  ctx.beginPath(); ctx.roundRect(x, y, width, 54, 20); ctx.fill();
  ctx.textAlign = "center";
  textBox(ctx, label, x + width / 2, y + 10, width - 24, 1, 27, 22, "#fff", 700);
  ctx.textAlign = "left";
}

export async function renderProfileSlide(slide: ProfileSlide): Promise<{ canvas: HTMLCanvasElement; warnings: string[] }> {
  const urls = (slide.galleryImages ?? []).filter(url => url?.trim()).slice(0, 5);
  const [assets, avatar, photos] = await Promise.all([
    Promise.all(ASSETS.map(name => loadSlideImage(`/member-slide/${name}`))),
    loadSlideImage(slide.photoURL),
    Promise.all(urls.map(loadSlideImage)),
    ...[400, 700, 800].map(weight => document.fonts.load(`${weight} 32px "Noto Sans"`, "Nguyễn Đặng Trần Quốc Việt")),
  ]);
  const [background, frame, logo, footerWhite, footerRed, swoosh] = assets;
  const canvas = document.createElement("canvas");
  canvas.width = SLIDE_WIDTH; canvas.height = SLIDE_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Trình duyệt không hỗ trợ xuất slide.");
  ctx.textBaseline = "top";
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, SLIDE_WIDTH, SLIDE_HEIGHT);
  if (background) {
    ctx.save(); ctx.globalAlpha = 0.53; // Same background opacity as the PowerPoint.
    ctx.drawImage(background, 0, 0, SLIDE_WIDTH, SLIDE_HEIGHT); ctx.restore();
  }
  if (footerWhite) ctx.drawImage(footerWhite, 1390, 873, 530, 207);
  if (footerRed) ctx.drawImage(footerRed, 1560, 873, 360, 207);

  // Chapter mark and the red title ribbon from the reference layout.
  ctx.fillStyle = "#ffffff"; ctx.fillRect(55, 28, 288, 191);
  if (logo) ctx.drawImage(logo, 92, 36, 215, 105);
  else textBox(ctx, "BNI", 100, 35, 220, 1, 90, 90, RED, 800);
  ctx.textAlign = "center";
  textBox(ctx, "KINH BAC", 199, 143, 280, 1, 37, 37, "#626262", 700);
  textBox(ctx, "TITANIUMCHAPTER", 199, 189, 278, 1, 21, 21, "#626262", 700);
  ctx.fillStyle = RED; ctx.fillRect(373, 28, 1500, 112);
  if (swoosh) {
    ctx.drawImage(swoosh, 373, 29, 230, 110);
    ctx.drawImage(swoosh, 1620, 29, 250, 110);
  }
  textBox(ctx, slide.kind === "member" ? "THÔNG TIN THÀNH VIÊN / MEMBER PROFILE" : "THÔNG TIN KHÁCH MỜI / GUEST PROFILE", 1120, 59, 1280, 1, 44, 30, "#fff", 800);

  if (avatar) {
    ctx.save(); ctx.beginPath(); ctx.arc(337, 465, 191, 0, Math.PI * 2); ctx.clip();
    cover(ctx, avatar, 146, 274, 382, 382, true); ctx.restore();
  }
  // The frame belongs to the template, even when the profile has no photo yet.
  if (frame) ctx.drawImage(frame, 100, 247, 480, 456);
  if (slide.name?.trim()) {
    ctx.fillStyle = RED; ctx.beginPath(); ctx.roundRect(60, 702, 575, 65, 18); ctx.fill();
    textBox(ctx, slide.name.trim().toLocaleUpperCase("vi-VN"), 347, 717, 550, 1, 34, 20, "#fff", 800);
  }
  let leftY = 791;
  if (slide.company?.trim()) {
    leftY += textBox(ctx, slide.company.trim().toLocaleUpperCase("vi-VN"), 347, leftY, 620, 2, 30, 21, RED, 700) + 14;
  }
  if (slide.phone?.trim()) {
    leftY += textBox(ctx, `HOTLINE: ${slide.phone.trim()}`, 347, leftY, 600, 1, 28, 22, "#00528d", 700) + 12;
  }
  if (slide.address?.trim()) {
    textBox(ctx, slide.address.trim(), 347, leftY, 610, 3, 27, 19, "#00528d", 700);
  }
  ctx.textAlign = "left";

  if (slide.industry?.trim()) {
    // Gold-edged orange arrow from the reference layout.
    ctx.fillStyle = "#f3c85e";
    ctx.beginPath(); ctx.moveTo(705, 243); ctx.lineTo(1755, 243); ctx.lineTo(1830, 326);
    ctx.lineTo(1755, 409); ctx.lineTo(705, 409); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#f58b08";
    ctx.beginPath(); ctx.moveTo(714, 252); ctx.lineTo(1750, 252); ctx.lineTo(1818, 326);
    ctx.lineTo(1750, 400); ctx.lineTo(714, 400); ctx.closePath(); ctx.fill();
    pill(ctx, "LĨNH VỰC HOẠT ĐỘNG", 765, 212, 465);
    ctx.textAlign = "center";
    textBox(ctx, slide.industry.trim().toLocaleUpperCase("vi-VN"), 1238, 294, 985, 2, 42, 26, "#fff", 800);
    ctx.textAlign = "left";
  }
  const loadedPhotos = photos.filter((photo): photo is HTMLImageElement => photo !== null);
  if (loadedPhotos.length) {
    textBox(ctx, "SẢN PHẨM TIÊU BIỂU", 710, 448, 1100, 1, 32, 32, RED, 800);
    const gap = 18, width = (1120 - gap * (loadedPhotos.length - 1)) / loadedPhotos.length;
    loadedPhotos.forEach((photo, index) => {
      const x = 710 + index * (width + gap);
      // Preserve the complete product/activity image instead of cropping its contents.
      const scale = Math.min(width / photo.naturalWidth, 235 / photo.naturalHeight);
      const w = photo.naturalWidth * scale, h = photo.naturalHeight * scale;
      ctx.drawImage(photo, x + (width - w) / 2, 504 + (235 - h) / 2, w, h);
    });
  }
  if (slide.targetMarket?.trim()) {
    pill(ctx, "THỊ TRƯỜNG MỤC TIÊU", 710, 777, 470);
    textBox(ctx, slide.targetMarket.trim(), 735, 852, 1060, 4, 36, 24, "#003b67", 700);
  }
  const warnings: string[] = [];
  if (slide.photoURL && !avatar) warnings.push("Không tải được ảnh đại diện.");
  if (photos.some(photo => !photo)) warnings.push("Một số ảnh sản phẩm/hoạt động chưa tải được.");
  if (assets.some(asset => !asset)) warnings.push("Một số chi tiết của mẫu slide chưa tải được. Vui lòng làm mới.");
  return { canvas, warnings };
}
