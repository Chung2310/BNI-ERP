import { ShieldCheck } from "lucide-react";
import { SEOHead } from "../seo/SEOHead";
import { BRAND_NAME, PRIVACY_POLICY_URL, SERVICE_WEBSITE_URL, SUPPORT_EMAIL, TERMS_OF_SERVICE_URL, USER_DATA_DELETION_URL } from "../config/brand";
import { privacyPolicy } from "../config/privacy-policy";
import { PRIVACY_SEO } from "../seo/seo-config";

export default function PrivacyPolicy() {
  return <main className="w-full max-w-5xl mx-auto space-y-6">
    <SEOHead meta={PRIVACY_SEO} />
    <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold uppercase tracking-wider">
            <ShieldCheck className="h-4 w-4" /><span>Quyền riêng tư</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">Chính sách bảo mật</h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-600">{privacyPolicy.intro}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm shrink-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Cập nhật lần cuối</p>
          <p className="mt-1 font-semibold text-slate-800">{privacyPolicy.updatedAt}</p>
          <p className="mt-1 text-slate-600">{BRAND_NAME}</p>
        </div>
      </div>
    </div>
    <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm space-y-8">
      {privacyPolicy.sections.map((section) => <section key={section.title} className="space-y-3">
        <h2 className="text-lg font-bold text-slate-900">{section.title}</h2>
        <div className="space-y-3 text-sm leading-6 text-slate-600">
          {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </div>
      </section>)}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-slate-900">Liên hệ và liên kết</h2>
        <div className="flex flex-col gap-3 text-sm text-sky-700">
          <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">Hỗ trợ quyền riêng tư: {SUPPORT_EMAIL}</a>
          <a href={SERVICE_WEBSITE_URL} className="underline">Website {BRAND_NAME}</a>
          <a href={PRIVACY_POLICY_URL} className="underline">Chính sách bảo mật</a>
          <a href={TERMS_OF_SERVICE_URL} className="underline">Điều khoản dịch vụ</a>
          <a href={USER_DATA_DELETION_URL} className="underline">Hướng dẫn yêu cầu xử lý dữ liệu</a>
        </div>
      </section>
    </div>
  </main>;
}
