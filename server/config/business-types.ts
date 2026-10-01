import { sanitizeModuleKeys, type ModuleKey } from "./module-keys";

export const BUSINESS_TYPES = ["general"] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];
export const DEFAULT_BUSINESS_TYPE: BusinessType = "general";

export function isBusinessType(value: unknown): value is BusinessType {
  return typeof value === "string" && (BUSINESS_TYPES as readonly string[]).includes(value);
}

export function resolveBusinessType(input: unknown, _legacyPreset?: unknown): BusinessType {
  return isBusinessType(input) ? input : DEFAULT_BUSINESS_TYPE;
}

export function getRequiredBusinessModule(_businessType: BusinessType): ModuleKey | null {
  return null;
}

export function filterModulesForBusinessType(input: unknown, _businessType: BusinessType): ModuleKey[] {
  return sanitizeModuleKeys(input);
}
