export type PermissionAction = "read" | "manage";

export type PermissionFeatureDefinition = {
  feature: string;
  label: string;
  group: string;
  description: { read: string; manage: string };
};

export type PermissionCatalogEntry = {
  code: string;
  feature: string;
  action: PermissionAction;
  label: string;
  group: string;
  description: string;
};

const feature = (feature: string, label: string, group: string): PermissionFeatureDefinition => ({
  feature,
  label,
  group,
  description: {
    read: `Xem dữ liệu ${label.toLocaleLowerCase("vi")}`,
    manage: `Quản lý ${label.toLocaleLowerCase("vi")}`,
  },
});

export const PERMISSION_FEATURES: PermissionFeatureDefinition[] = [
  feature("dashboard", "Tổng quan", "Tổng quan"),
  feature("people", "Con người", "Con người"),
  feature("relationship", "Quan hệ", "Quan hệ"),
  feature("hr", "Thành viên", "Thành viên"),
  feature("timekeeping", "Chấm công", "Thành viên"),
  feature("meetings", "Cuộc họp", "Vận hành"),
  feature("resource", "Tài nguyên", "Tài nguyên"),
  feature("chat", "Trò chuyện", "Trò chuyện"),
  feature("settings", "Cấu hình", "Cấu hình"),
  feature("access", "Người dùng và vai trò", "Quản trị truy cập"),
];

export const PERMISSION_CATALOG: PermissionCatalogEntry[] = PERMISSION_FEATURES.flatMap((entry) => (
  (["read", "manage"] as const).map((action) => ({
    code: `${entry.feature}:${action}`,
    feature: entry.feature,
    action,
    label: action === "read" ? `Xem ${entry.label.toLocaleLowerCase("vi")}` : `Quản lý ${entry.label.toLocaleLowerCase("vi")}`,
    group: entry.group,
    description: entry.description[action],
  }))
));

export type PermissionCode = `${string}:${PermissionAction}`;

const permissionCodeSet = new Set(PERMISSION_CATALOG.map((entry) => entry.code));
export const PERMISSION_CODES = PERMISSION_CATALOG.map((entry) => entry.code);

export class PermissionValidationError extends Error {
  readonly invalidCodes: string[];

  constructor(invalidCodes: string[]) {
    super(`Mã quyền không hợp lệ: ${invalidCodes.join(", ")}`);
    this.name = "PermissionValidationError";
    this.invalidCodes = invalidCodes;
  }
}

export function isPermissionCode(code: string): code is PermissionCode {
  return permissionCodeSet.has(code);
}

export const isCanonicalPermission = isPermissionCode;

export function expandEffectivePermissions(codes: readonly string[]): Set<string> {
  const expanded = new Set<string>(codes);
  for (const code of codes) {
    if (code.endsWith(":manage")) expanded.add(`${code.slice(0, -":manage".length)}:read`);
  }
  return expanded;
}

export function compactStoredPermissions(codes: readonly string[] = []): {
  stored: string[];
  effective: string[];
} {
  const unique = [...new Set(codes)];
  const invalidCodes = unique.filter((code) => !isPermissionCode(code)).sort();
  if (invalidCodes.length) throw new PermissionValidationError(invalidCodes);

  const stored = new Set(unique);
  for (const code of unique) {
    if (code.endsWith(":manage")) stored.delete(`${code.slice(0, -":manage".length)}:read`);
  }
  const sortedStored = [...stored].sort();
  return {
    stored: sortedStored,
    effective: [...expandEffectivePermissions(sortedStored)].sort(),
  };
}

export function normalizeStoredPermissions(
  codes: readonly string[] = [],
  options: { allowWildcard?: boolean } = {},
): string[] {
  const wildcard = codes.includes("*");
  const withoutWildcard = codes.filter((code) => code !== "*");
  if (wildcard && !options.allowWildcard) {
    throw new PermissionValidationError(["*"]);
  }
  const stored = compactStoredPermissions(withoutWildcard).stored;
  return wildcard ? ["*", ...stored].sort() : stored;
}

export const RECRUITMENT_PERMISSION: PermissionCode = "recruitment:manage";
