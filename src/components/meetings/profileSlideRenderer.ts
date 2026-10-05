import type { ProfileSlide } from "./slideTypes";
import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/700.css";
import "@fontsource/be-vietnam-pro/800.css";

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
  ctx.font = `${weight} ${size}px "Be Vietnam Pro", sans-serif`;
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

export function textBox(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, width: number, maxLines: number, size: number, minSize: number, color: string, weight = 400, height = maxLines * size * 1.35) {
  let lines: string[] = [];
  let chosen = size;
  for (; chosen >= minSize; chosen -= 1) {
    font(ctx, chosen, weight);
    lines = wrapSlideText(ctx, value, width);
    if (lines.length <= maxLines && lines.length * chosen * 1.35 <= height && lines.every(line => ctx.measureText(line).width <= width)) break;
  }
  chosen = Math.max(chosen, minSize);
  font(ctx, chosen, weight);
  const visibleLines = Math.max(1, Math.min(maxLines, Math.floor(height / (chosen * 1.35))));
  if (lines.length > visibleLines) {
    lines = lines.slice(0, visibleLines);
    let last = lines[visibleLines - 1];
    while (last && ctx.measureText(last + "…").width > width) last = last.slice(0, -1);
    lines[visibleLines - 1] = last + "…";
  }
  ctx.save();
  const left = ctx.textAlign === "center" ? x - width / 2 : ctx.textAlign === "right" ? x - width : x;
  ctx.beginPath(); ctx.rect(left, y, width, height); ctx.clip();
  ctx.fillStyle = color;
  const top = y + Math.max(0, (height - lines.length * chosen * 1.35) / 2);
  lines.forEach((line, i) => ctx.fillText(line, x, top + i * chosen * 1.35, width));
  ctx.restore();
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
  ctx.save();
  ctx.shadowColor = "rgba(80, 0, 0, 0.3)"; ctx.shadowBlur = 9; ctx.shadowOffsetY = 6;
  ctx.fillStyle = "#9e0710";
  ctx.beginPath(); ctx.roundRect(x, y + 9, width, 54, 18); ctx.fill();
  ctx.shadowColor = "transparent";
  const face = ctx.createLinearGradient(0, y, 0, y + 54);
  face.addColorStop(0, "#ff4148"); face.addColorStop(0.22, "#f51b28"); face.addColorStop(1, "#cc0718");
  ctx.fillStyle = face;
  ctx.beginPath(); ctx.roundRect(x, y, width, 54, 18); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.beginPath(); ctx.roundRect(x + 12, y + 4, width - 24, 7, 4); ctx.fill();
  ctx.textAlign = "center";
  textBox(ctx, label, x + width / 2, y + 8, width - 24, 1, 27, 18, "#fff", 700, 42);
  ctx.restore();
}

export async function renderProfileSlide(slide: ProfileSlide): Promise<{ canvas: HTMLCanvasElement; warnings: string[] }> {
  const urls = (slide.galleryImages ?? []).filter(url => url?.trim()).slice(0, 5);
  const [assets, avatar, photos] = await Promise.all([
    Promise.all(ASSETS.map(name => loadSlideImage(`/member-slide/${name}`))),
    loadSlideImage(slide.photoURL),
    Promise.all(urls.map(loadSlideImage)),
    ...[400, 700, 800].map(weight => document.fonts.load(`${weight} 32px "Be Vietnam Pro"`, "Nguyễn Đặng Trần Quốc Việt")),
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
    // Crop the photo to the clear circular opening so it stays behind the gold rim and leaves.
    // Opening measured on the 400×380 frame: center (198,184), radius 148.
    // Extend slightly beneath the opaque gold rim to avoid a white seam.
    ctx.save(); ctx.beginPath(); ctx.arc(338, 468, 180, 0, Math.PI * 2); ctx.clip();
    cover(ctx, avatar, 158, 288, 360, 360, true); ctx.restore();
  }
  // The frame belongs to the template, even when the profile has no photo yet.
  if (frame) ctx.drawImage(frame, 100, 247, 480, 456);
  if (slide.name?.trim()) {
    pill(ctx, slide.name.trim().toLocaleUpperCase("vi-VN"), 60, 710, 575);
  }
  if (slide.company?.trim()) {
    textBox(ctx, slide.company.trim().toLocaleUpperCase("vi-VN"), 347, 789, 610, 2, 32, 16, RED, 700, 80);
  }
  if (slide.phone?.trim()) {
    textBox(ctx, `HOTLINE: ${slide.phone.trim()}`, 347, 878, 600, 1, 28, 16, "#00528d", 700, 42);
  }
  if (slide.address?.trim()) {
    textBox(ctx, slide.address.trim(), 347, 934, 610, 3, 29, 16, "#00528d", 700, 105);
  }
  ctx.textAlign = "left";

  if (slide.industry?.trim()) {
    // Slanted left edge, pale gold border and detached bevelled chevron from the template.
    ctx.fillStyle = "#fff59b";
    ctx.beginPath(); ctx.moveTo(748, 243); ctx.lineTo(1755, 243); ctx.lineTo(1813, 326);
    ctx.lineTo(1755, 409); ctx.lineTo(692, 409); ctx.closePath(); ctx.fill();
    const arrow = ctx.createLinearGradient(0, 252, 0, 400);
    arrow.addColorStop(0, "#db4800"); arrow.addColorStop(1, "#c83900");
    ctx.fillStyle = arrow;
    ctx.beginPath(); ctx.moveTo(756, 252); ctx.lineTo(1750, 252); ctx.lineTo(1801, 326);
    ctx.lineTo(1750, 400); ctx.lineTo(705, 400); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#f3ce60";
    ctx.beginPath(); ctx.moveTo(1770, 243); ctx.lineTo(1804, 243); ctx.lineTo(1863, 326);
    ctx.lineTo(1804, 409); ctx.lineTo(1770, 409); ctx.lineTo(1828, 326); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#ed8a07";
    ctx.beginPath(); ctx.moveTo(1774, 252); ctx.lineTo(1807, 259); ctx.lineTo(1854, 326);
    ctx.lineTo(1807, 393); ctx.lineTo(1774, 400); ctx.lineTo(1833, 326); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#ae620d";
    ctx.beginPath(); ctx.moveTo(1854, 326); ctx.lineTo(1863, 326); ctx.lineTo(1804, 409);
    ctx.lineTo(1770, 409); ctx.lineTo(1807, 393); ctx.closePath(); ctx.fill();
    pill(ctx, "LĨNH VỰC HOẠT ĐỘNG", 765, 212, 465);
    ctx.textAlign = "center";
    textBox(ctx, slide.industry.trim().toLocaleUpperCase("vi-VN"), 1248, 278, 960, 3, 48, 18, "#fff", 800, 112);
    ctx.textAlign = "left";
  }
  const loadedPhotos = photos.filter((photo): photo is HTMLImageElement => photo !== null);
  if (loadedPhotos.length) {
    pill(ctx, "SẢN PHẨM TIÊU BIỂU", 710, 432, 485);
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
    textBox(ctx, slide.targetMarket.trim(), 735, 852, 1020, 5, 40, 17, "#003b67", 700, 170);
  }
  const warnings: string[] = [];
  if (slide.photoURL && !avatar) warnings.push("Không tải được ảnh đại diện.");
  if (photos.some(photo => !photo)) warnings.push("Một số ảnh sản phẩm/hoạt động chưa tải được.");
  if (assets.some(asset => !asset)) warnings.push("Một số chi tiết của mẫu slide chưa tải được. Vui lòng làm mới.");
  return { canvas, warnings };
}
