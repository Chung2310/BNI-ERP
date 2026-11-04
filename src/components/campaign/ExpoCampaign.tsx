import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, CalendarDays, Check, Clock3, MapPin, Phone } from "lucide-react";
import { CampaignIllustration, type IllustrationKind } from "./CampaignIllustration";
import "./expo-motion.css";

const files = "/expo-bac-ninh";
const guestRegistration = "https://bcagroup.net/bca_ZuvZNv";
const memberRegistration = "https://bcagroup.net/events/bni-expo-2026-bac-ninh-512";

const schedule = [
  ["13:00–13:15", "Đón tiếp, ổn định hội trường"],
  ["13:15–13:25", "Lễ rước cờ và đánh trống khai mạc"],
  ["13:25–13:35", "Tuyên bố khai mạc và phát biểu"],
  ["13:35–13:50", "Vinh danh và tri ân Ban tổ chức, Nhà tài trợ"],
  ["13:50–13:55", "Nhà tài trợ Kim Cương chia sẻ"],
  ["13:55–14:30", "Chụp hình và quay video tập thể"],
  ["14:30–15:30", "Speed Matching — 3 phiên kết nối nhanh"],
  ["15:30–18:00", "Tham quan gian hàng và xúc tiến giao thương"],
  ["18:00–19:00", "Bế mạc và bàn giao mặt bằng"],
];

const sponsorPackages = [
  {
    name: "Kim Cương", price: "20.000.000đ", availability: "1 suất duy nhất",
    benefits: [
      "Giới thiệu doanh nghiệp trực tiếp tại buổi khai mạc (3 phút)",
      "Bài giới thiệu doanh nghiệp trên Facebook BNI Việt Nam",
      "Thẻ VIP trong sự kiện",
      "Phát video trình chiếu tại màn hình sự kiện",
      "Giới thiệu gian hàng và quay video giới thiệu gian hàng",
      "Cúp tri ân",
      "Ấn phẩm và logo trên backdrop",
      "Tặng gian hàng trưng bày và vé tham gia",
    ],
  },
  {
    name: "Vàng", price: "10.000.000đ", availability: "2 suất duy nhất",
    benefits: [
      "Bài giới thiệu doanh nghiệp trên Facebook BNI Việt Nam",
      "Thẻ VIP trong sự kiện",
      "Phát video trình chiếu tại màn hình sự kiện",
      "Giới thiệu gian hàng và quay video giới thiệu gian hàng",
      "Cúp tri ân",
      "Ấn phẩm và logo trên backdrop",
      "Tặng gian hàng trưng bày và vé tham gia",
    ],
  },
  {
    name: "Bạc", price: "5.000.000đ", availability: "Tối đa 5 suất",
    benefits: [
      "Phát video trình chiếu tại màn hình sự kiện (giới hạn 5 doanh nghiệp)",
      "Giới thiệu gian hàng và quay video giới thiệu gian hàng",
      "Cúp tri ân",
      "Ấn phẩm và logo trên backdrop",
      "Tặng gian hàng trưng bày và vé tham gia",
    ],
  },
  {
    name: "Đồng", price: "2.000.000đ", availability: "",
    benefits: [
      "Tặng gian hàng trưng bày và vé tham gia",
      "Bằng vinh danh",
    ],
  },
];

const sponsorIcons: Record<string, IllustrationKind> = {
  "Kim Cương": "diamond",
  "Vàng": "gold",
  "Bạc": "silver",
  "Đồng": "bronze",
};

const navigation = [
  ["#expo-thu-moi", "Thư mời & lịch trình"],
  ["#expo-tai-tro", "Tài trợ"],
  ["#expo-thanh-vien", "Thành viên"],
  ["#expo-ve-tham-du", "Vé tham dự"],
  ["#expo-gian-hang", "Gian hàng"],
  ["#expo-khung-anh", "Khung ảnh"],
];

function ExternalAction({ href, children, quiet = false }: { href: string; children: React.ReactNode; quiet?: boolean }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" title="Mở trong tab mới" className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-base font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00adfc] ${quiet ? "border border-slate-200 bg-white text-slate-800 hover:border-[#00adfc]" : "bg-[#b4082d] text-white hover:bg-[#930723]"}`}>
      {children}<ArrowUpRight className="h-4 w-4 shrink-0" />
    </a>
  );
}

function SectionHeading({ number, eyebrow, title, icon }: { number: string; eyebrow: string; title: string; icon: IllustrationKind }) {
  return <div className="mb-7 flex items-center gap-4"><CampaignIllustration kind={icon} className="h-14 w-14 shrink-0 sm:h-16 sm:w-16" /><div><p className="text-base font-medium tracking-wide text-[#b4082d]">{number} / {eyebrow}</p><h2 className="mt-1 text-[1.9rem] font-semibold leading-tight tracking-tight text-[#111827] sm:text-[2.6rem]">{title}</h2></div></div>;
}

function EventFacts({ time = "07:00–17:00" }: { time?: string }) {
  return <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-base text-slate-600"><span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4 text-[#b4082d]" /> 11/11/2026</span><span className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4 text-[#b4082d]" /> {time}</span><span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-[#b4082d]" /> Trung tâm Văn hóa Kinh Bắc, Bắc Ninh</span></div>;
}

export function ExpoCampaign() {
  const [preview, setPreview] = useState<{ src: string; alt: string } | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState(navigation[0][0]);
  const previewDialog = useRef<HTMLDialogElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const navigationBar = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = page.current;
    const nav = navigationBar.current;
    if (!root || !nav) return;

    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (window.innerWidth >= 768 && !reducedMotion?.matches && "IntersectionObserver" in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("expo-in-view");
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.08, rootMargin: "0px 0px -8% 0px" });
      root.classList.add("expo-motion-ready");
      root.querySelectorAll(".expo-section").forEach((section) => observer.observe(section));

      const onMotionChange = () => {
        if (reducedMotion?.matches) {
          root.classList.remove("expo-motion-ready");
          observer.disconnect();
        }
      };
      reducedMotion?.addEventListener("change", onMotionChange);
      return () => {
        observer.disconnect();
        reducedMotion?.removeEventListener("change", onMotionChange);
      };
    }
  }, []);

  useEffect(() => {
    const root = page.current;
    const cards = root?.querySelector<HTMLElement>(".expo-sponsor-cards");
    if (!root || !cards || window.innerWidth < 1280 || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;

    root.classList.add("expo-cards-motion-ready");
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        cards.classList.add("expo-cards-open");
        observer.disconnect();
      }
    }, { threshold: 0.12 });
    observer.observe(cards);
    return () => {
      observer.disconnect();
      root.classList.remove("expo-cards-motion-ready");
    };
  }, []);

  useEffect(() => {
    const nav = navigationBar.current;
    if (!nav) return;
    let frame = 0;
    const updateActiveSection = () => {
      frame = 0;
      const current = navigation.reduce((active, [href]) => {
        const section = document.getElementById(href.slice(1));
        return section && section.getBoundingClientRect().top <= nav.offsetHeight + 120 ? href : active;
      }, navigation[0][0]);
      setActiveSection((previous) => previous === current ? previous : current);
    };
    const requestUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(updateActiveSection);
    };
    updateActiveSection();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    return () => {
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const dialog = previewDialog.current;
    if (!dialog) return;
    if (preview && !dialog.open) dialog.showModal();
    if (!preview && dialog.open) dialog.close();
  }, [preview]);

  return (
    <div ref={page} className="expo-campaign text-slate-800">
      <header className="expo-hero relative overflow-hidden bg-gradient-to-br from-[#f1faff] via-white to-[#eaf6ff] px-6 py-12 sm:px-10 sm:py-16 lg:px-14 lg:py-20">
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[#00adfc]/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-36 left-1/4 h-80 w-80 rounded-full bg-[#2563eb]/8 blur-3xl" />
        <div className="relative grid items-center gap-10 lg:grid-cols-[1fr_0.95fr] lg:gap-14">
          <div>
            <p className="text-base font-medium text-[#b4082d]">BNI Accelerate · Bắc Ninh 2026</p>
            <h1 className="mt-4 max-w-4xl text-[2.65rem] font-semibold leading-[1.16] tracking-tight text-[#111827] sm:text-[3.8rem] lg:text-[4.4rem]">Gặp đúng người.<br /><span className="text-[#b4082d]">Mở rộng cơ hội.</span></h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">BNI EXPO Bắc Ninh kết nối cộng đồng doanh nhân, giới thiệu thương hiệu và mở ra những cuộc gặp có giá trị lâu dài.</p>
            <EventFacts />
            <div className="mt-8 flex flex-wrap gap-3"><a href="#expo-ve-tham-du" className="inline-flex min-h-11 items-center rounded-lg bg-[#b4082d] px-5 py-2.5 text-base font-medium text-white transition hover:bg-[#930723]">Xem cách tham dự</a><a href="#expo-thu-moi" className="inline-flex min-h-11 items-center rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-base font-medium text-slate-800 transition hover:border-[#00adfc]">Thư mời & lịch trình</a></div>
          </div>
          <div className="expo-hero-poster border border-slate-200 bg-white p-2 shadow-[0_12px_40px_rgba(24,34,54,0.08)]"><img src={`${files}/danh-cho-khach-moi.jpg`} alt="Thông tin BNI EXPO Bắc Ninh 2026 dành cho khách mời" width="1280" height="720" className="w-full" /></div>
        </div>
      </header>

      <nav ref={navigationBar} aria-label="Nội dung sự kiện" className="expo-nav sticky top-0 z-10 px-6 text-base text-slate-700 backdrop-blur sm:px-10 lg:px-14">
        <button type="button" aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen((open) => !open)} className="flex min-h-12 w-full items-center justify-between font-medium sm:hidden">Xem các mục trên trang <span aria-hidden="true">{mobileMenuOpen ? "−" : "+"}</span></button>
        {mobileMenuOpen && <div className="grid grid-cols-2 gap-1 py-2 sm:hidden">{navigation.map(([href, label]) => <a key={href} href={href} aria-current={activeSection === href ? "location" : undefined} onClick={() => setMobileMenuOpen(false)} className="px-2 py-3 font-medium transition-colors hover:text-[#075f79]">{label}</a>)}</div>}
        <div className="hidden items-center gap-5 overflow-x-auto whitespace-nowrap py-2 sm:flex">{navigation.map(([href, label]) => <a key={href} href={href} aria-current={activeSection === href ? "location" : undefined} className="inline-flex min-h-10 shrink-0 items-center px-2 font-medium transition-colors hover:text-[#075f79] focus-visible:text-[#075f79]">{label}</a>)}</div>
      </nav>

      <div className="px-6 sm:px-10 lg:px-14">
        <section id="expo-thu-moi" className="expo-section scroll-mt-24 py-14 sm:py-20">
          <SectionHeading number="01" eyebrow="Lời mời" title="Thư mời & lịch trình" icon="invite" />
          <p className="max-w-5xl text-lg leading-8 text-slate-600">Trân trọng kính mời Anh/Chị tham dự BNI EXPO & Kết nối kinh doanh. Sự kiện quy tụ cộng đồng doanh nghiệp tại Trung tâm Văn hóa Kinh Bắc, Bắc Ninh.</p>
          <div className="mt-7 grid gap-7 lg:grid-cols-[1fr_0.86fr]">
            <div className="self-start"><img src={`${files}/thu-moi-timeline.jpg`} alt="Thư mời BNI EXPO và lịch trình chương trình" width="1280" height="901" className="w-full border border-slate-200 bg-white p-2" /><button type="button" onClick={() => setPreview({ src: `${files}/thu-moi-timeline.jpg`, alt: "Thư mời BNI EXPO và lịch trình chương trình" })} className="mt-3 inline-flex min-h-10 items-center rounded-lg border border-slate-200 px-4 text-base font-medium text-slate-700 hover:border-[#00adfc]">Xem ảnh thư mời lớn hơn</button></div>
            <div className="border-l border-slate-200 pl-6 sm:pl-8">
              <h3 className="text-xl font-semibold tracking-tight text-slate-900">Lịch trình theo thư mời</h3>
              <ol className="mt-5 divide-y divide-slate-200">{schedule.map(([time, title]) => <li key={time} className="grid grid-cols-[100px_1fr] gap-3 py-3 text-base leading-6"><span className="font-medium tabular-nums text-[#b4082d]">{time}</span><span className="text-slate-700">{title}</span></li>)}</ol>
              <p className="mt-5 text-base leading-7 text-slate-600">Khách mời vui lòng có mặt trước 13:00, mặc trang phục doanh nhân trang trọng và mang danh thiếp nếu có.</p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3"><ExternalAction href="https://canva.link/1q14s52idip4eh2">Mở công cụ tạo thư mời có ảnh</ExternalAction><ExternalAction href="https://canva.link/rp46a8fvr39j486" quiet>Mở thư mời điền tên</ExternalAction><button type="button" onClick={() => setPreview({ src: `${files}/thu-moi-timeline-khac.jpg`, alt: "Mẫu thư mời BNI EXPO khác" })} className="inline-flex min-h-11 items-center rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-base font-medium text-slate-800 hover:border-[#00adfc]">Xem mẫu thư mời khác tại đây</button></div>
        </section>

        <section id="expo-tai-tro" className="expo-section scroll-mt-24 border-t border-slate-200 py-14 sm:py-20">
          <SectionHeading number="02" eyebrow="Đồng hành" title="Thư kêu gọi tài trợ" icon="sponsor" />
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-center lg:gap-12">
            <div>
              <div className="space-y-4 text-lg leading-8 text-slate-600"><p>Kính gửi Quý Anh/Chị,</p><p><span className="expo-red-gradient">BNI Accelerate</span> trân trọng mời Quý doanh nghiệp đồng hành cùng <span className="expo-red-gradient">EXPO Bắc Ninh</span>. Đây là sự kiện kết nối giao thương quy tụ đông đảo chủ doanh nghiệp trong khu vực, giúp Quý doanh nghiệp quảng bá thương hiệu và mở rộng mạng lưới khách hàng, đối tác.</p></div>
              <div className="mt-8 border-l-2 border-[#00adfc] pl-6"><p className="expo-price text-4xl font-semibold tracking-tight">200</p><p className="mt-1 text-lg text-slate-600">gian hàng kết nối giao thương</p></div>
            </div>
            <img src={`${files}/minh-hoa-ket-noi-gian-hang.png`} alt="Minh họa doanh nhân kết nối tại gian hàng triển lãm" width="1536" height="1024" loading="lazy" className="aspect-[3/2] w-full rounded-2xl border border-slate-200 object-cover" />
          </div>
          <h3 className="mt-12 text-xl font-semibold tracking-tight text-slate-900">Các hạng đồng hành</h3>
          <div className="expo-sponsor-cards mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-5">
            {sponsorPackages.map((tier) => (
              <article key={tier.name} className="expo-sponsor-card min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.11)] sm:p-6">
                <div className="min-h-32 border-b border-slate-200 pb-5">
                  <div className="flex items-center gap-3">
                    <CampaignIllustration kind={sponsorIcons[tier.name]} className="h-12 w-12 shrink-0" />
                    <h4 className="text-lg font-semibold leading-snug text-slate-900">Đối tác {tier.name}</h4>
                  </div>
                  <p className="expo-price mt-3 text-2xl tracking-tight">{tier.price}</p>
                  {tier.availability && <p className="mt-1 text-sm text-slate-500">{tier.availability}</p>}
                </div>
                <ul className="mt-5 space-y-3 text-base leading-6 text-slate-700">
                  {tier.benefits.map((benefit) => (
                    <li key={benefit} className="flex gap-2.5">
                      <Check aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-[#20a464]" strokeWidth={2.5} />
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
          <div className="mt-10 border-t border-slate-200 pt-8">
            <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Bàn trưng bày tiêu chuẩn</h3>
                <p className="mt-2 text-base leading-7 text-slate-600">1 bàn, 2 ghế · Thành viên BNI: <span className="expo-price">500.000đ</span>/bàn · Khách mời: <span className="expo-price">600.000đ</span>/bàn.</p>
              </div>
              <ul className="space-y-2 text-base leading-7 text-slate-600">
                <li>Vị trí gian hàng được sắp xếp theo hạng tài trợ, từ Kim Cương đến Đồng.</li>
                <li>Ưu tiên doanh nghiệp đăng ký sớm.</li>
                <li>Địa điểm: Trung tâm Văn hóa Kinh Bắc, TP Bắc Ninh, tỉnh Bắc Ninh.</li>
              </ul>
            </div>
            <div className="mt-7 flex flex-wrap items-center gap-4 border-t border-slate-100 pt-5">
              <span className="inline-flex items-center gap-2 text-base font-medium text-[#b4082d]"><Phone className="h-4 w-4" /> Liên hệ đăng ký: Phạm Thị Giang · 0969 634 131</span>
              <button type="button" onClick={() => setPreview({ src: files + "/thu-moi-tai-tro.jpg", alt: "Thư mời tài trợ và bảng quyền lợi gốc" })} className="inline-flex min-h-10 items-center rounded-lg border border-slate-200 px-4 text-base font-medium text-slate-700 hover:border-[#00adfc]">Xem thư mời tài trợ gốc</button>
            </div>
          </div>
          <p className="mt-6 text-base leading-7 text-slate-600">Rất mong được đồng hành cùng Quý doanh nghiệp tại EXPO Bắc Ninh. Trân trọng.</p>
        </section>

        <section id="expo-thanh-vien" className="expo-section scroll-mt-24 border-t border-slate-200 py-14 sm:py-20">
          <SectionHeading number="03" eyebrow="Cộng đồng BNI" title="Dành cho thành viên" icon="member" />
          <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr] lg:items-center"><div><div className="space-y-4 text-lg leading-8 text-slate-600"><p>Là thành viên <span className="expo-red-gradient">BNI</span>, chúng ta đều hiểu giá trị của việc gặp đúng người, trao đúng cơ hội và xây dựng những mối quan hệ có thể phát triển lâu dài.</p><p><span className="expo-red-gradient">EXPO Bắc Ninh 2026</span> là một sân chơi để Anh/Chị mở rộng thêm những kết nối đó — gặp thêm doanh nghiệp, khách hàng, đối tác và những mối quan hệ mới ngoài vòng kết nối thường ngày.</p><p>Chọn cách tham gia phù hợp và tận dụng tối đa cơ hội kết nối tại <span className="text-[#111827]">EXPO Bắc Ninh 2026</span>.</p></div><EventFacts /><p className="mt-4 text-base leading-7 text-slate-600">Ban Tổ chức: <span className="text-[#111827]">BNI IMPACT · BNI SWAT · BNI KINHBAC · BNI KBG · BNI FAMOUS.</span></p></div><img src={`${files}/danh-cho-thanh-vien.jpg`} alt="Poster EXPO Bắc Ninh dành cho thành viên BNI" width="1280" height="720" className="w-full border border-slate-200" /></div>
          <div className="mt-8 grid gap-8 md:grid-cols-2"><div className="border-t border-slate-200 pt-5"><h3 className="flex items-center gap-3 text-xl font-semibold text-slate-900"><CampaignIllustration kind="ticket" className="h-10 w-10 shrink-0" /><span>Vé tham dự · <span className="expo-price">200.000đ</span></span></h3><p className="mt-2 text-lg leading-8 text-slate-600">Dành cho Anh/Chị muốn đến kết nối, gặp gỡ doanh nghiệp, tìm khách hàng, đối tác, nhà cung cấp và khám phá thêm những cơ hội kinh doanh mới.</p></div><div className="border-t border-slate-200 pt-5"><h3 className="flex items-center gap-3 text-xl font-semibold text-slate-900"><CampaignIllustration kind="booth" className="h-10 w-10 shrink-0" /><span>Bàn triển lãm · <span className="expo-price">500.000đ</span></span></h3><p className="mt-2 text-lg leading-8 text-slate-600">Dành cho Anh/Chị muốn chủ động giới thiệu sản phẩm, dịch vụ, tăng hiện diện thương hiệu và tạo thêm nhiều cuộc trò chuyện trực tiếp với khách tham dự.</p></div></div>
          <div className="mt-6"><ExternalAction href={memberRegistration}>Mở trang đăng ký cho thành viên</ExternalAction></div>
        </section>

        <section id="expo-ve-tham-du" className="expo-section scroll-mt-24 border-t border-slate-200 py-14 sm:py-20">
          <SectionHeading number="04" eyebrow="Khách mời" title="Vé tham dự" icon="ticket" />
          <p className="mb-5 max-w-5xl text-lg font-medium leading-8 text-slate-900">Thêm một ngày kết nối, thêm nhiều cơ hội cho doanh nghiệp.</p>
          <div className="max-w-5xl space-y-4 text-lg leading-8 text-slate-600"><p>Không phải lúc nào cơ hội kinh doanh cũng đến từ một cuộc hẹn đã được sắp trước. Đôi khi, nó bắt đầu từ việc mình có mặt đúng nơi, gặp đúng người và bắt đầu một cuộc trò chuyện đủ giá trị.</p><p>Tại <span className="expo-red-gradient">EXPO Bắc Ninh 2026</span>, Anh/Chị có thể gặp gỡ các chủ doanh nghiệp, tìm hiểu nhiều sản phẩm – dịch vụ, mở rộng thêm mối quan hệ với khách hàng, đối tác, nhà cung cấp và những người có thể kết nối mình đến các cơ hội tiếp theo.</p><p>Điều đáng giá hơn cả là Anh/Chị có thể trực tiếp quan sát cách các doanh nhân trong cộng đồng BNI kết nối, giới thiệu cơ hội và hỗ trợ nhau trong kinh doanh.</p></div>
          <EventFacts />
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-slate-200 pt-5"><span className="text-base font-medium text-[#b4082d]">Khách mời tham dự miễn phí</span><span className="text-base text-slate-600">Khi đăng ký, chọn “VÉ THAM DỰ”.</span></div><div className="mt-6"><ExternalAction href={guestRegistration}>Mở trang đăng ký vé tham dự</ExternalAction></div>
        </section>

        <section id="expo-gian-hang" className="expo-section scroll-mt-24 border-t border-slate-200 py-14 sm:py-20">
          <SectionHeading number="05" eyebrow="Trưng bày" title="Dành cho khách đăng ký gian hàng" icon="booth" />
          <p className="mb-5 max-w-5xl text-lg font-medium leading-8 text-slate-900">Hãy để sản phẩm của bạn được nhìn thấy nhiều hơn.</p>
          <div className="max-w-5xl space-y-4 text-lg leading-8 text-slate-600"><p>Làm ra một sản phẩm tốt đã tốn rất nhiều công sức. Nhưng nếu sản phẩm không xuất hiện đúng nơi, trước đúng khách hàng, thì rất nhiều công sức đó có thể chỉ dừng lại ở việc mình biết mình tốt, còn thị trường thì chưa biết đến mình.</p><p>Nếu Anh/Chị đang có sản phẩm hoặc dịch vụ muốn giới thiệu rộng hơn, bàn triển lãm tại EXPO Bắc Ninh 2026 là dịp để mang thương hiệu của mình ra gặp khách hàng trực tiếp.</p><p>Tại gian hàng, Anh/Chị có thể giới thiệu sản phẩm, trò chuyện với người quan tâm, nghe thêm nhu cầu thực tế và mở ra những kết nối mới với khách hàng, đối tác hoặc nhà phân phối phù hợp.</p><p>Trong BNI, rất nhiều mối quan hệ kinh doanh lâu dài bắt đầu từ một điểm chạm rất đơn giản. Và gian hàng tại EXPO có thể chính là điểm chạm đầu tiên đó.</p></div>
          <EventFacts />
          <div className="mt-6 border-t border-slate-200 pt-5 text-base leading-7 text-slate-600"><p>Bàn trưng bày tiêu chuẩn: 1 bàn, 2 ghế.</p><p>Thành viên BNI: <span className="expo-price">500.000đ</span>/bàn · Khách mời: <span className="expo-price">600.000đ</span>/bàn.</p><p>Khi đăng ký, chọn “BÀN TRIỂN LÃM”.</p></div><div className="mt-6"><ExternalAction href={guestRegistration}>Mở trang đăng ký bàn triển lãm</ExternalAction></div>
        </section>

        <section id="expo-khung-anh" className="expo-section scroll-mt-24 border-t border-slate-200 py-14 sm:py-20">
          <div className="border-t-2 border-[#00adfc] bg-gradient-to-r from-[#fff1f3] via-[#fff9fa] to-[#eaf8ff] p-7 sm:p-10"><SectionHeading number="06" eyebrow="Lan tỏa sự kiện" title="Thay khung ảnh đại diện" icon="frame" /><p className="max-w-4xl text-lg leading-8 text-slate-600">Cùng dùng khung ảnh BNI EXPO Bắc Ninh để chia sẻ lời mời đến cộng đồng doanh nghiệp.</p><div className="mt-6"><ExternalAction href="https://khunghinh.net/p/bni-expo-bac-ninh">Mở trang thay khung ảnh</ExternalAction></div></div>
        </section>
      </div>
      <dialog ref={previewDialog} onClose={() => setPreview(null)} className="m-auto max-h-[94vh] max-w-[min(94vw,1100px)] border-0 bg-white p-3 shadow-2xl backdrop:bg-slate-950/80 sm:p-5" aria-label="Xem ảnh chiến dịch">
        <div className="mb-3 flex justify-end"><button type="button" onClick={() => setPreview(null)} className="min-h-10 rounded-lg border border-slate-200 px-4 text-base font-medium text-slate-700 hover:bg-slate-50">Đóng ảnh</button></div>
        {preview && <img src={preview.src} alt={preview.alt} className="max-h-[78vh] w-auto max-w-full object-contain" />}
      </dialog>
    </div>
  );
}
