import { getAccessToken } from "./authService";
export type UserImportRow = { rowNumber: number; displayName: string; email: string; phone: string; companyName: string; industry: string; birthDate: string; photoURL?: string; coverImage?: string };
export type UserImportResultRow = { rowNumber: number; email: string; status: "valid" | "created" | "skipped" | "error"; message: string };
export type UserImportResult = { rows: UserImportResultRow[]; created: number; valid: number; skipped: number; errors: number };
export async function submitUserImport(rows: UserImportRow[], dryRun: boolean): Promise<UserImportResult> {
  const response = await fetch("/api/v1/auth/users/import", {
    method: "POST", headers: { Authorization: "Bearer " + (getAccessToken() || ""), "Content-Type": "application/json" },
    body: JSON.stringify({ rows, dryRun }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message || "Không thể nhập tài khoản.");
  return payload.data;
}
