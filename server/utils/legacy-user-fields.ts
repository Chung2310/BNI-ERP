/** Retired User fields: shared by response sanitization and the one-off DB migration. */
export const LEGACY_USER_FIELDS = [
  "facebookIntegration", "facebookIntegreation", "tiktokIntegration", "zaloIntegration",
  "googleDriveIntegration", "aiAutoReplyConfig", "heygenAccess",
  "jobTitle", "level", "qualification", "department", "isLeader", "division",
] as const;

export function stripLegacyUserFields<T extends object>(user: T): T {
  for (const field of LEGACY_USER_FIELDS) delete (user as Record<string, unknown>)[field];
  return user;
}
