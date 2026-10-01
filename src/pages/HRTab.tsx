import React, { useState, useEffect, useRef, lazy, Suspense } from "react";
import { FolderTree, Mail, ChevronLeft, ChevronRight } from "lucide-react";
import { HRSubTabType, EmployeeNode, UserProfile } from "../types";
import { useAuth } from "../context/AuthContext";
import { authService } from "../services/authService";
import { toast } from "./Toast";
import { getApiErrorMessage } from "../utils/errorMessage";
import { useSubTabRouter } from "../hooks/useSubTabRouter";
import { HR_SUB_TAB_ROUTES } from "../router/subTabRoutes";

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
  const canManageCelebration = userProfile?.role === "admin" || hasPermission("settings:manage");

  const [subTab, setSubTab] = useSubTabRouter<HRSubTabType>(HR_SUB_TAB_ROUTES, "SƠ ĐỒ TỔ CHỨC");
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const companyCode = userProfile?.companyCode || "";

  // Fetch users list from API
  const fetchUsers = async () => {
    setLoading(true);
    try {
      let data: UserProfile[] = [];
      if (companyCode) {
        data = await authService.getUsersByCompany(companyCode);
      } else if (userProfile) {
        data = [userProfile];
      }
      setUsersList(data);
    } catch (error) {
      console.error("Lỗi khi tải danh sách thành viên:", error);
      toast.error(getApiErrorMessage(error, "Không thể tải sơ đồ tổ chức."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [companyCode, userProfile?.uid]);

  // Map user profile to EmployeeNode tree model
  const employees: EmployeeNode[] = usersList.map((usr) => ({
    id: usr.uid,
    name: usr.displayName,
    role: usr.jobTitle || (
      usr.role === "admin" ? "Quản trị viên" :
      usr.role === "manager" ? "Quản lý" : "Thành viên"
    ),
    department: usr.department || "Ban Giám đốc",
    email: usr.email,
    phone: usr.phone || "Chưa cập nhật",
    avatar:
      usr.photoURL && (usr.photoURL.startsWith("http") || usr.photoURL.startsWith("/"))
        ? usr.photoURL
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(usr.displayName)}&background=random&color=fff`,
    level: usr.level || (
      usr.role === "admin" ? 1 :
      usr.role === "manager" ? 2 : 3
    ),
    parentId: usr.parentId,
    status: usr.status || "offline",
    division: usr.division || "Khối Vận Hành",
    isLeader: usr.isLeader,
    jobDescriptionLink: usr.jobDescriptionLink || "",
    monthlySalary: usr.monthlySalary,
    companyName: usr.companyName,
    industry: usr.industry,
    birthDate: usr.birthDate,
    coverImage: usr.coverImage,
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
              { id: "SƠ ĐỒ TỔ CHỨC", label: "Sơ đồ tổ chức", icon: FolderTree },
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
