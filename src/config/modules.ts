import type { TabType } from "../types";
import { isModuleAllowedForBusinessType, resolveBusinessType } from "./businessTypes";

/** Đồng bộ với server/config/module-keys.ts */
export const MODULE_KEYS = ["hr", "resource", "chat"] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];
export const DEFAULT_MODULE_KEYS = [...MODULE_KEYS];

export const MODULE_LABELS: Record<ModuleKey, string> = {
  hr: "Thành viên",
  resource: "Quản lý tài nguyên",
  chat: "Trò chuyện",
};

export const MODULE_TAB_MAP: Record<ModuleKey, TabType> = {
  hr: "NHÂN SỰ",
  resource: "QUẢN LÝ TÀI NGUYÊN",
  chat: "TRÒ CHUYỆN",
};

export const TAB_MODULE_MAP: Partial<Record<TabType, ModuleKey>> = {
  "NHÂN SỰ": "hr",
  "QUẢN LÝ TÀI NGUYÊN": "resource",
  "TÀI NGUYÊN": "resource",
  "TRÒ CHUYỆN": "chat",
};

export const MODULE_OPTIONS = [
  { key: "hr", label: MODULE_LABELS.hr, moduleKeys: ["hr"] },
  { key: "resource", label: MODULE_LABELS.resource, moduleKeys: ["resource"] },
  { key: "chat", label: MODULE_LABELS.chat, moduleKeys: ["chat"] },
] as const satisfies ReadonlyArray<{ key: string; label: string; moduleKeys: readonly ModuleKey[] }>;

/**
 * Mã quyền tối thiểu để user được coi là có quyền truy cập tab
 */
export const MODULE_READ_PERMISSIONS: Partial<Record<TabType, string[]>> = {
  "TỔNG QUAN": ["dashboard:read", "meetings:read", "meetings:manage"],
  "BẢNG XẾP HẠNG": ["dashboard:read"],
  "CUỘC HỌP": ["meetings:read", "meetings:manage"],
  "NHÂN SỰ": ["hr:read", "access:read", "work:read"],
  "QUẢN LÝ TÀI NGUYÊN": ["resource:read"],
  "TÀI NGUYÊN": ["resource:read"],
  "TRÒ CHUYỆN": ["chat:read"],
};

export const HIDDEN_TABS = new Set<TabType>();

export function isTabHidden(tab: TabType): boolean {
  return HIDDEN_TABS.has(tab);
}

export const HIDDEN_SETTINGS_SUBTABS = new Set<string>([
  "personal-integrations",
  "company-integrations",
]);

export function isSettingsSubTabHidden(value: string): boolean {
  return HIDDEN_SETTINGS_SUBTABS.has(value);
}

export const HIDE_AI_AUTO_REPLY = true;

export function isModuleEnabled(enabledModules: string[] | undefined, key: ModuleKey): boolean {
  if (!enabledModules || enabledModules.length === 0) return true;
  return enabledModules.includes(key);
}

/** Keep permanent tabs and tenant modules that are enabled. */
export function filterEnabledTabs(tabs: TabType[], enabledModules: string[] | undefined, businessTypeInput?: unknown): TabType[] {
  const businessType = resolveBusinessType(businessTypeInput);
  return tabs.filter((tab) => {
    const moduleKey = TAB_MODULE_MAP[tab];
    return !moduleKey || (isModuleEnabled(enabledModules, moduleKey) && isModuleAllowedForBusinessType(moduleKey, businessType));
  });
}

/** Resolve direct navigation to a disabled module without rendering restricted content. */
export function resolveEnabledTab(tab: TabType, enabledModules: string[] | undefined, businessTypeInput?: unknown): TabType {
  const moduleKey = TAB_MODULE_MAP[tab];
  const businessType = resolveBusinessType(businessTypeInput);
  return moduleKey && (!isModuleEnabled(enabledModules, moduleKey) || !isModuleAllowedForBusinessType(moduleKey, businessType)) ? "TỔNG QUAN" : tab;
}
