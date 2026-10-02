// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { renderProfileSlide } from "./profileSlideRenderer";
import type { ProfileSlide } from "./slideTypes";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it.each(["guest", "member"] as const)("renders populated %s fields without field headings or empty cards", async kind => {
  vi.stubGlobal("Image", class {
    naturalWidth = 1920; naturalHeight = 1080;
    onload?: () => void;
    set src(_value: string) { queueMicrotask(() => this.onload?.()); }
  });
  Object.defineProperty(document, "fonts", { configurable: true, value: { load: vi.fn().mockResolvedValue([]) } });
  const ctx = { font: "", fillText: vi.fn(), drawImage: vi.fn(), fillRect: vi.fn(), beginPath: vi.fn(), roundRect: vi.fn(), fill: vi.fn(),
    save: vi.fn(), restore: vi.fn(), arc: vi.fn(), clip: vi.fn(), measureText: (text: string) => ({ width: text.length * 12 }) };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as any);
  const slide: ProfileSlide = { id: kind, kind, name: "An", company: "ACME", industry: "Thiết kế", phone: "0901234567", email: "an@example.com", bio: "Giới thiệu của An", photoURL: "", coverImage: "" };
  await renderProfileSlide(slide);
  const text = ctx.fillText.mock.calls.map(call => call[0]);
  for (const value of ["ACME", "Thiết kế", "0901234567", "an@example.com", "Giới thiệu của An"]) expect(text.join(" ")).toContain(value);
  for (const label of ["BIO / GIỚI THIỆU NGẮN", "LĨNH VỰC", "LOẠI HÌNH DỊCH VỤ", "SỐ ĐIỆN THOẠI"]) expect(text).not.toContain(label);
  const bioY = ctx.fillText.mock.calls.find(call => call[0] === slide.bio)![2];
  expect(ctx.roundRect).toHaveBeenCalledTimes(1); // Only the member/guest badge remains.
  ctx.fillText.mockClear(); ctx.roundRect.mockClear();
  await renderProfileSlide({ ...slide, company: " ", industry: "", phone: " ", email: "" });
  expect(ctx.fillText.mock.calls.find(call => call[0] === slide.bio)![2]).toBeLessThan(bioY);
  expect(ctx.roundRect).toHaveBeenCalledTimes(1);
  ctx.fillText.mockClear();
  await renderProfileSlide({ ...slide, company: "", industry: "", phone: "", email: "", bio: " " });
  expect(ctx.fillText.mock.calls.map(call => call[0])).not.toContain(slide.bio);
});
