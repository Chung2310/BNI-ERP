import { useEffect } from "react";
import { ExpoCampaign } from "../components/campaign/ExpoCampaign";
import { SEOHead } from "../seo/SEOHead";

export default function ExpoHomePage() {
  useEffect(() => {
    const targetId = window.location.hash.slice(1);
    if (!targetId) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({ block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <main className="min-h-screen bg-white font-sans antialiased">
      <SEOHead meta={{
        title: "BNI EXPO Bắc Ninh 2026 - Kết nối kinh doanh",
        description: "Thư mời, lịch trình, thông tin tài trợ, vé tham dự và gian hàng BNI EXPO Bắc Ninh ngày 11/11/2026.",
        keywords: "BNI EXPO Bắc Ninh 2026, thư mời, tài trợ, vé tham dự, gian hàng",
        path: "/trang-chu",
      }} />
      <div className="mx-auto w-full max-w-[1800px]">
        <ExpoCampaign />
      </div>
    </main>
  );
}
