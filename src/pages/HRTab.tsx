import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import { Users, Mail, Wallet, ChevronLeft, ChevronRight } from "lucide-react";
import { HRSubTabType, EmployeeNode, UserProfile } from "../types";
import { useAuth } from "../context/AuthContext";
import { authService } from "../services/authService";
import { toast } from "./Toast";
import { getApiErrorMessage } from "../utils/errorMessage";
import { useSubTabRouter } from "../hooks/useSubTabRouter";
import { HR_SUB_TAB_ROUTES } from "../router/subTabRoutes";

const MemberFeesTab = lazy(() => import("../components/hr/MemberFeesTab"));

// Lazy-loaded subcomponents
const OrgChartTab = lazy(() => import("../components/hr/OrgChartTab"));
const CelebrationEmailTab = lazy(() => import("../components/hr/CelebrationEmailTab"));
const CELEBRATION_TAB = "EMAIL CHÚC MỪNG" as HRSubTabType;

export default function HRTab() {
  const subTabsRef = useRef<HTMLDivElement>(null);
  const scrollSubTabs = (direction: "left" | "right") => subTabsRef.current?.scrollBy({ left: direction === "left" ? -280 : 280, behavior: "smooth" });
  const { userProfile, hasPermission } = useAuth();
  const isManager =
    userProfile?.role === "admin" ||
    userProfile?.role === "manager";
  const canManageOrgChart = isManager || hasPermission("access:manage");
  const canReadFees = hasPermission("hr:read") || hasPermission("hr:manage") || hasPermission("access:manage");
  const canManageCelebration = userProfile?.role === "admin" || hasPermission("settings:manage");

  const [subTab, setSubTab] = useSubTabRouter<HRSubTabType>(HR_SUB_TAB_ROUTES, "SƠ ĐỒ TỔ CHỨC");
  const [fetchedUsers, setUsersList] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(!!userProfile?.companyCode);

  const companyCode = userProfile?.companyCode || "";

  const usersList = companyCode ? fetchedUsers : userProfile ? [userProfile] : [];
  const [requestInputs, setRequestInputs] = useState(() => [companyCode, userProfile?.uid]);
  if (!Object.is(requestInputs[0], companyCode) || !Object.is(requestInputs[1], userProfile?.uid)) {
    setRequestInputs([companyCode, userProfile?.uid]);
    setLoading(!!companyCode); setUsersList([]);
  }
  const fetchUsers = useCallback(() => {
    if (!companyCode) return;
    return authService.getUsersByCompany(companyCode).then(setUsersList).catch(error => {
      console.error("Lỗi khi tải danh sách thành viên:", error);
      toast.error(getApiErrorMessage(error, "Không thể tải danh sách thành viên."));
    }).finally(() => setLoading(false));
  }, [companyCode]);
  useEffect(() => { void fetchUsers(); }, [fetchUsers, userProfile?.uid]);

  // Map user profile to EmployeeNode tree model (excluding admin)
  const employees: EmployeeNode[] = usersList
    .filter((usr) => usr.role !== "admin")
    .map((usr) => ({
      id: usr.uid,
      name: usr.displayName,
      role: usr.role === "manager" ? "Quản lý" : "Thành viên",
    email: usr.email,
    phone: usr.phone || "Chưa cập nhật",
    avatar:
      usr.photoURL && (usr.photoURL.startsWith("http") || usr.photoURL.startsWith("/"))
        ? usr.photoURL
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(usr.displayName)}&background=random&color=fff`,
    parentId: usr.parentId,
    status: usr.status || "offline",
    jobDescriptionLink: usr.jobDescriptionLink || "",
    monthlySalary: usr.monthlySalary,
    companyName: usr.companyName,
    industry: usr.industry,
    birthDate: usr.birthDate,
    gender: usr.gender,
    address: usr.address,
    targetMarket: usr.targetMarket,
    coverImage: usr.coverImage,
    galleryImages: usr.galleryImages,
  }));


  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white max-h-[85vh] overflow-hidden" id="hr_tab_wrapper">
      <h1 className="sr-only">Thành viên - {subTab}</h1>

      {/* Sub Tabs switcher navigation bar */}
      <div className="flex shrink-0 flex-col items-stretch gap-3 border-b border-slate-200/80 bg-white px-3 pt-2 pb-0 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-5" id="hr_sub_tabs_bar">
        <div className="flex min-w-0 flex-1 items-center gap-1 select-none">
          <button type="button" aria-label="Cuộn tab sang trái" onClick={() => scrollSubTabs("left")} className="flex h-6 w-5 shrink-0 items-center justify-center text-slate-400 transition-colors hover:text-slate-700 sm:hidden"><ChevronLeft className="h-4 w-4" /></button>
          <div ref={subTabsRef} className="flex min-w-0 max-w-full flex-1 gap-1 overflow-x-auto select-none scrollbar-none -mb-px">
            {[
              { id: "SƠ ĐỒ TỔ CHỨC", label: "Thành viên", icon: Users },
              ...(canReadFees ? [{ id: "PHÍ THƯỜNG NIÊN", label: "Phí thường niên", icon: Wallet }] : []),
              ...(canManageCelebration ? [{ id: CELEBRATION_TAB, label: "Email chúc mừng", icon: Mail }] : []),
            ].map((tab) => {
              const isActive = subTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSubTab(tab.id as HRSubTabType)}
                  className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs transition-all duration-200 cursor-pointer shrink-0 rounded-xl ${
                    isActive
                      ? "bg-cyan-600 text-white font-bold shadow-sm"
                      : "text-slate-600 hover:text-cyan-600 hover:bg-cyan-50 font-semibold"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? "text-white" : "text-slate-400"}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
          <button type="button" aria-label="Cuộn tab HR sang phải" onClick={() => scrollSubTabs("right")} className="flex h-6 w-5 shrink-0 items-center justify-center text-slate-400 transition-colors hover:text-slate-700 sm:hidden"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      {/* Conditional Rendering of Modular Tab Components */}
      <Suspense fallback={<TabLoader label="Đang tải dữ liệu thành viên..." />}>
        {subTab === "SƠ ĐỒ TỔ CHỨC" && (
          <OrgChartTab
            userProfile={userProfile}
            selectedCompanyCode={companyCode}
            usersList={usersList}
            employees={employees}
            fetchUsers={fetchUsers}
            isManager={canManageOrgChart}
            companies={[]}
            courses={[]}
            fetchCourses={async () => {}}
            loading={loading}
          />
        )}

        {subTab === "PHÍ THƯỜNG NIÊN" && (canReadFees ? <MemberFeesTab /> : <p className="p-6 text-sm text-slate-500">Bạn chưa có quyền xem phí thường niên.</p>)}
        {subTab === CELEBRATION_TAB && canManageCelebration && <CelebrationEmailTab />}
      </Suspense>
    </div>
  );
}

function TabLoader({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-3 rounded-2xl bg-white border border-gray-150 p-6 text-center">
      <div className="w-8 h-8 border-3 border-indigo-650 border-t-transparent rounded-full animate-spin" />
      <span className="text-xs text-gray-500 font-semibold">{label}</span>
    </div>
  );
}
