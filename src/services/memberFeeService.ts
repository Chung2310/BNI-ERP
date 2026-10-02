import { getAccessToken } from "./authService";
export type MemberFeeStatus = "unpaid" | "partial" | "overdue" | "paid";
export type FeeMember = { id: string; name: string; email: string };
export type FeePayment = { id: string; amount: number; paidOn: string; method: "cash" | "transfer"; reference: string; note: string; recordedBy: string; recordedAt: string; voidedAt?: string; voidReason?: string };
export type MemberFee = { _id: string; campaignId?: string; memberId: string; memberName: string; memberEmail: string; year: number; title: string; amount: number; dueDate: string; note: string; paid: number; remaining: number; status: MemberFeeStatus; payments: FeePayment[]; overpaid?: number; notifiedAt?: string; emailNotifiedAt?: string; checkout?: { bank: string; accountNumber: string; accountName: string; paymentCode: string; amount: number; qrUrl: string } | null };
export type CreateMemberFee = { campaignId?: string; year: number; title: string; amount: number; dueDate: string; note: string; memberIds: string[] };
export type ReceiveMemberFee = Pick<FeePayment, "id" | "amount" | "paidOn" | "method" | "reference" | "note">;
async function request<T>(path: string, method = "GET", body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch("/api/v1/member-fees" + path, {
    method, signal, headers: { Authorization: "Bearer " + (getAccessToken() || ""), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message || "Không thể tải dữ liệu phí thành viên.");
  return payload.data;
}
export type FeeSePayConfig = { enabled: boolean; bank: string; accountNumber: string; accountName: string; hasApiKey: boolean; webhookPath: string };
export type FeeSePayTransaction = { _id: string; transactionId: number; status: "pending" | "review" | "applied" | "ignored"; reason: string; feeId?: string; payload: { transferAmount: number; transactionDate: string; gateway: string; accountNumber: string; content: string } };
export const memberFeeService = {
  sepayConfig: () => request<FeeSePayConfig>("/sepay/config"),
  transactions: () => request<FeeSePayTransaction[]>("/sepay/transactions"),
  notify: (id: string) => request<MemberFee>("/" + id + "/notify", "POST"),
  list: (year: number, signal?: AbortSignal) => request<MemberFee[]>("/?year=" + year, "GET", undefined, signal),
  get: (id: string) => request<MemberFee>("/" + id),
  members: (signal?: AbortSignal) => request<FeeMember[]>("/members", "GET", undefined, signal),
  create: (body: CreateMemberFee) => request<{ created: number; skipped: number }>("/", "POST", body),
  pay: (id: string, body: ReceiveMemberFee) => request<MemberFee>("/" + id + "/payments", "POST", body),
  receive: (id: string, body: ReceiveMemberFee) => request<MemberFee>("/" + id + "/payments", "POST", body),
  voidPayment: (feeId: string, paymentId: string, reason: string) => request<MemberFee>("/" + feeId + "/payments/" + paymentId + "/void", "POST", { reason }),
  delete: (id: string) => request<{ message: string }>("/" + id, "DELETE"),
};
