interface DashboardModuleUser {
  role: string;
  enabledModules?: string[];
  /** Tập hợp mã quyền hiệu lực của user */
  permissions?: Set<string>;
}

export function resolveDashboardModuleAccess(user: DashboardModuleUser) {
  const hasModule = (key: string) => {
    if (user.role === "admin") return true;
    if (!user.enabledModules || user.enabledModules.length === 0) return true;
    return user.enabledModules.includes(key);
  };

  const hasPermission = (code: string) => {
    if (user.role === "admin") return true;
    if (!user.permissions) return true;
    return user.permissions.has("*") || user.permissions.has(code);
  };

  return {
    hr: hasModule("hr") && hasPermission("hr:read"),
    chat: hasModule("chat") && hasPermission("chat:read"),
    resource: hasModule("resource") && hasPermission("resource:read"),
    timekeeping: hasPermission("timekeeping:read"),
  };
}
