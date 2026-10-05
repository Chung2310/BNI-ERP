// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { renderProfileSlide } from "./profileSlideRenderer";
import type { ProfileSlide } from "./slideTypes";
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it.each(["guest", "member"] as const)("fills the template with %s data and hides missing sections", async kind => {
  vi.stubGlobal("Image", class {
    naturalWidth = 1920; naturalHeight = 1080;
    onload?: () => void;
    set src(_value: string) { queueMicrotask(() => this.onload?.()); }
  });
  Object.defineProperty(document, "fonts", { configurable: true, value: { load: vi.fn().mockResolvedValue([]) } });
  const ctx = { font: "", fillText: vi.fn(), drawImage: vi.fn(), fillRect: vi.fn(), beginPath: vi.fn(), roundRect: vi.fn(), fill: vi.fn(),
    moveTo: vi.fn(), lineTo: vi.fn(), closePath: vi.fn(), save: vi.fn(), restore: vi.fn(), arc: vi.fn(), clip: vi.fn(), measureText: (text: string) => ({ width: text.length * 12 }) };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as any);
  const slide: ProfileSlide = { id: kind, kind, name: "Nguyễn An", company: "ACME", industry: "Thiết kế", phone: "0901234567", bio: "", photoURL: "/avatar.png", coverImage: "", address: "Bắc Ninh", targetMarket: "Doanh nghiệp", galleryImages: Array.from({ length: 6 }, (_, i) => `/product-${i}.png`) };
  const { canvas, warnings } = await renderProfileSlide(slide);
  expect([canvas.width, canvas.height]).toEqual([1920, 1080]);
  expect(warnings).toEqual([]);
  const text = ctx.fillText.mock.calls.map(call => call[0]).join(" ");
  for (const value of ["NGUYỄN AN", "ACME", "THIẾT KẾ", "HOTLINE: 0901234567", "Bắc Ninh", "Doanh nghiệp", "SẢN PHẨM TIÊU BIỂU"]) expect(text).toContain(value);
  expect(ctx.clip).toHaveBeenCalledOnce();
  expect(ctx.drawImage.mock.calls.filter(call => call.length === 5 && call[2] >= 504 && call[2] < 740)).toHaveLength(5);
  ctx.fillText.mockClear(); ctx.clip.mockClear(); ctx.drawImage.mockClear();
  await renderProfileSlide({ ...slide, company: " ", industry: "", phone: " ", address: "", targetMarket: " ", galleryImages: [], photoURL: "" });
  const sparseText = ctx.fillText.mock.calls.map(call => call[0]).join(" ");
  for (const value of ["HOTLINE", "LĨNH VỰC HOẠT ĐỘNG", "THỊ TRƯỜNG MỤC TIÊU", "SẢN PHẨM TIÊU BIỂU", "ACME"]) expect(sparseText).not.toContain(value);
  expect(ctx.clip).not.toHaveBeenCalled();
  expect(ctx.drawImage).toHaveBeenCalledWith(expect.anything(), 100, 247, 480, 456);
});
