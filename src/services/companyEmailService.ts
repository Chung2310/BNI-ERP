import { getAccessToken } from "./authService";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1/company-email${path}`, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken()}`, ...(init?.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || "Không thể xử lý yêu cầu email.");
  return body.data ?? body;
}

export type SmtpSettings = Omit<import("../../server/interface/company.interface").ICompanySmtpConfig, "passwordEncrypted"> & { password?: string; hasPassword?: boolean };
export type CelebrationConfig = import("../../server/interface/company.interface").ICompanyCelebrationConfig;
export type CelebrationPreview = { holidayName?: string; subject: string; html: string };
export type CelebrationHistory = { _id: string; recipientEmail: string; eventType: string; eventDate: string; status: string };
export const companyEmailApi = {
  getSmtp: () => request<SmtpSettings>("/smtp"),
  saveSmtp: (data: SmtpSettings) => {
    const { host, port, secure, user, password, fromEmail, fromName } = data;
    return request<SmtpSettings>("/smtp", { method: "PUT", body: JSON.stringify({ host, port, secure, user, password, fromEmail, fromName }) });
  },
  verifySmtp: () => request<{ success: boolean }>("/smtp/verify", { method: "POST" }),
  testSmtp: () => request<{ messageId: string }>("/smtp/test", { method: "POST" }),
  getCelebration: () => request<CelebrationConfig>("/celebration"),
  saveCelebration: (data: CelebrationConfig & { uploadTokens?: string[] }) => request<CelebrationConfig>("/celebration", { method: "PUT", body: JSON.stringify(data) }),
  preview: (data: CelebrationPreview & { holidayName?: string }) => request<CelebrationPreview>("/celebration/preview", { method: "POST", body: JSON.stringify(data) }),
  history: () => request<CelebrationHistory[]>("/celebration/history"),
};
