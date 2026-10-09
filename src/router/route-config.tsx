import { lazy } from "react";
import { MODULE_READ_PERMISSIONS } from "../config/modules";
import type { ComponentType, LazyExoticComponent } from "react";
import type { TabType, UserProfile } from "../types";

export type LazyPageComponent = LazyExoticComponent<ComponentType>;

export type AppRoute = {
  tab: TabType;
  component: LazyPageComponent;
  canAccess?: (userProfile: UserProfile) => boolean;
};

export const APP_ROUTES: AppRoute[] = [
  {
    tab: "TỔNG QUAN",
    component: lazy(() => import("../pages/DashboardTab")),
    canAccess: (userProfile) =>
      userProfile.role === "admin" ||
      (userProfile.role === "superadmin" && Boolean(userProfile.companyCode)) ||
      Boolean(
        userProfile.permissions?.includes("*") ||
        MODULE_READ_PERMISSIONS["TỔNG QUAN"]?.some(permission => userProfile.permissions?.includes(permission))
      ),
  },
  {
    tab: "BẢNG XẾP HẠNG",
    component: lazy(() => import("../pages/RankingsTab")),
    canAccess: (userProfile) =>
      userProfile.role === "admin" ||
      Boolean(
        userProfile.permissions?.includes("*") ||
        MODULE_READ_PERMISSIONS["BẢNG XẾP HẠNG"]?.some(permission => userProfile.permissions?.includes(permission))
      ),
  },
  {
    tab: "NHÂN SỰ",
    component: lazy(() => import("../pages/HRTab")),
  },
  {
    tab: "CUỘC HỌP",
    component: lazy(() => import("../pages/MeetingTab")),
  },
  {
    tab: "QUẢN LÝ TÀI NGUYÊN",
    component: lazy(() => import("../pages/ResourceTab")),
  },
  {
    tab: "TÀI NGUYÊN",
    component: lazy(() => import("../pages/ResourceTab")),
  },
  {
    tab: "TRÒ CHUYỆN",
    component: lazy(() => import("../pages/ChatTab")),
  },
  {
    tab: "PHÂN TÍCH & BÁO CÁO",
    component: lazy(() => import("../pages/AnalyticsTab")),
    canAccess: (userProfile) => userProfile.role === "admin",
  },
  {
    tab: "QUẢN TRỊ USER",
    component: lazy(() => import("../pages/UserAdminTab")),
    canAccess: (userProfile) => userProfile.role === "admin",
  },
  {
    tab: "CÀI ĐẶT",
    component: lazy(() => import("../pages/SettingsTab")),
  },
];

export const DEFAULT_APP_TAB: TabType = "TỔNG QUAN";

export function getRouteByTab(tab: TabType) {
  return APP_ROUTES.find((route) => route.tab === tab) || APP_ROUTES[0];
}
