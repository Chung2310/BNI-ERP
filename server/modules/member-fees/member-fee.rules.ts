export type FeePayment = { id: string; amount: number; voidedAt?: Date | string | null };
export function feeBalance(fee: { amount: number; dueDate: string; payments: FeePayment[] }, today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date())) {
  const paid = fee.payments.filter(p => !p.voidedAt).reduce((sum, p) => sum + p.amount, 0);
  const remaining = Math.max(0, fee.amount - paid);
  const overpaid = Math.max(0, paid - fee.amount);
  const status = remaining <= 0 ? "paid" : fee.dueDate < today ? "overdue" : paid > 0 ? "partial" : "unpaid";
  return { paid, remaining, overpaid, status };
}
export function feeTitleKey(title: string) {
  return title.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("vi");
}
