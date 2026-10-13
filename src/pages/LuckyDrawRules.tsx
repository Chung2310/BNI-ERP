import { Gift } from "lucide-react";
import { BRAND_NAME, LUCKY_DRAW_RULES_URL, SERVICE_WEBSITE_URL, SUPPORT_EMAIL } from "../config/brand";
import { SEOHead } from "../seo/SEOHead";
import { LUCKY_DRAW_RULES_SEO } from "../seo/seo-config";

const sections = [
  {
    title: "1. Organizer and purpose",
    paragraphs: [
      `${BRAND_NAME}'s Lucky Draw is a tool for selecting a participant during a business meeting. It is operated by the meeting administrator on the presentation screen or from the mobile remote control.`,
      "The Chapter organizing a meeting sponsors and is responsible for any real prize offered in that meeting. iGen Connect provides the draw software; it does not sponsor or deliver the Chapter's prize.",
      "The app does not sell draw entries, accept wagers, or require an in-app purchase to participate. A draw does not guarantee that a physical prize exists.",
    ],
  },
  {
    title: "2. Who can participate",
    paragraphs: [
      "Before each draw, the meeting administrator chooses a participant filter and may select individual people. Available filters include present attendees, all participants, Chapter members, absent members, and guests. Only people in the selected eligible pool can be drawn.",
      "The organizing Chapter should tell participants the meeting time, eligibility, prize details, and any event-specific conditions before starting the draw. People removed from the pool are not eligible for that draw.",
    ],
  },
  {
    title: "3. How a winner is chosen",
    paragraphs: [
      "The server randomly selects one person from the eligible pool. The presentation wheel displays that result; its animation is a visual representation of the selection.",
      "The result is recorded in the meeting's winner list. After a draw, the administrator can exclude the winner from later draws or keep them eligible to participate again. The administrator may change the filter or selected pool before a later draw.",
    ],
  },
  {
    title: "4. Prizes and verification",
    paragraphs: [
      "The organizing Chapter must announce the prize, quantity, delivery method, and event-specific conditions. The app records a draw result but does not automatically deliver a prize or verify a participant's identity.",
      "The organizing Chapter is responsible for checking eligibility, contacting the selected participant, resolving disputes, and fulfilling the prize it announced. If no prize was announced for a meeting, the result is for meeting entertainment only.",
    ],
  },
  {
    title: "5. Apple disclaimer and contact",
    paragraphs: [
      "Apple Inc. is not a sponsor of, and is not involved in, the Lucky Draw or any meeting prize in any manner. Apple has no responsibility for administration, winner selection, or prize fulfillment.",
      `For questions about the app or these rules, contact ${SUPPORT_EMAIL}. For a specific meeting or prize, contact the Chapter organizing that meeting. The public version of these rules is available at ${SERVICE_WEBSITE_URL}${LUCKY_DRAW_RULES_URL}.`,
    ],
  },
];

export default function LuckyDrawRules() {
  return (
    <main className="w-full max-w-5xl mx-auto space-y-6">
      <SEOHead meta={LUCKY_DRAW_RULES_SEO} />
      <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 text-sky-700 text-xs font-bold uppercase tracking-wider">
              <Gift className="h-4 w-4" />
              <span>Meeting feature</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">Lucky Draw Rules</h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-600">
              Thể lệ vòng quay may mắn trong cuộc họp trên {BRAND_NAME}. These rules describe how the meeting draw works and who is responsible for any prize.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm shrink-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Last updated</p>
            <p className="mt-1 font-semibold text-slate-800">October 13, 2026</p>
          </div>
        </div>
      </div>
      <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm space-y-8">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-slate-700">
          Apple is not a sponsor of, or involved in, this draw or any associated prize.
        </div>
        {sections.map((section) => (
          <section key={section.title} className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">{section.title}</h2>
            <div className="space-y-3 text-sm leading-6 text-slate-600">
              {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
