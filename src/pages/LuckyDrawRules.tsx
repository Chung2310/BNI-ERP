import { Users } from "lucide-react";
import { BRAND_NAME, SUPPORT_EMAIL } from "../config/brand";
import { wheelSelectionGuide } from "../config/wheel-selection-guide";
import { SEOHead } from "../seo/SEOHead";
import { LUCKY_DRAW_RULES_SEO } from "../seo/seo-config";

export default function LuckyDrawRules() {
  return <main className="mx-auto w-full max-w-5xl space-y-6">
    <SEOHead meta={LUCKY_DRAW_RULES_SEO} />
    <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="inline-flex items-center gap-2 text-sm font-semibold text-sky-700"><Users className="h-5 w-5" />{BRAND_NAME}</div>
      <h1 className="text-3xl font-extrabold text-slate-900">Hướng dẫn vòng quay may mắn</h1>
      <p className="text-sm leading-6 text-slate-600">Chọn ngẫu nhiên người phát biểu, trình bày hoặc tham gia hoạt động trong cuộc họp.</p>
      <p className="text-xs text-slate-500">Cập nhật ngày {wheelSelectionGuide.updatedAt}</p>
    </div>
    <div className="space-y-8 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      {wheelSelectionGuide.sections.map((section) => <section key={section.title} className="space-y-3">
        <h2 className="text-lg font-bold text-slate-900">{section.title}</h2>
        {section.paragraphs.map((paragraph) => <p key={paragraph} className="text-sm leading-6 text-slate-600">{paragraph}</p>)}
      </section>)}
      <a href={`mailto:${SUPPORT_EMAIL}`} className="inline-block text-sm font-semibold text-sky-700 underline">Liên hệ hỗ trợ: {SUPPORT_EMAIL}</a>
    </div>
  </main>;
}