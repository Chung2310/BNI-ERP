import type { SubTabRouteMap } from "../hooks/useSubTabRouter";
import type {
  TabType,
  HRSubTabType,
  ResourceSubTabType,
} from "../types";

export type SettingsSubTabType =
  | "profile"
  | "security"
  | "erp";

export const HR_SUB_TAB_ROUTES: SubTabRouteMap<HRSubTabType> = [
  { slug: "thanh-vien", value: "SƠ ĐỒ TỔ CHỨC" },
  { slug: "so-do", value: "SƠ ĐỒ TỔ CHỨC" },
  { slug: "phi-thuong-nien", value: "PHÍ THƯỜNG NIÊN" },
  { slug: "email-chuc-mung", value: "EMAIL CHÚC MỪNG" as HRSubTabType },
];

export const RESOURCE_SUB_TAB_ROUTES: SubTabRouteMap<ResourceSubTabType> = [
  { slug: "tai-lieu", value: "TÀI LIỆU KHÁC" },
];

export const SETTINGS_SUB_TAB_ROUTES: SubTabRouteMap<SettingsSubTabType> = [
  { slug: "ho-so", value: "profile" },
  { slug: "bao-mat", value: "security" },
  { slug: "cau-hinh", value: "erp" },
];

const SUB_TAB_ROUTES_BY_TAB: Partial<Record<TabType, SubTabRouteMap<string>>> = {
  "NHÂN SỰ": HR_SUB_TAB_ROUTES,
  "QUẢN LÝ TÀI NGUYÊN": RESOURCE_SUB_TAB_ROUTES,
  "TÀI NGUYÊN": RESOURCE_SUB_TAB_ROUTES,
  "CÀI ĐẶT": SETTINGS_SUB_TAB_ROUTES,
};

/** Tra slug ?sub= cho một sub-tab; trả "" nếu tab/sub-tab không có slug. */
export function subTabToSlug(tab: TabType, subTab: string): string {
  const routes = SUB_TAB_ROUTES_BY_TAB[tab];
  return routes?.find((entry) => entry.value === subTab)?.slug || "";
}
