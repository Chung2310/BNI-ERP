export function resolveSePayEnvironment(companyCode: string, env: Record<string, string | undefined> = process.env) {
  const issues: string[] = [];
  const configuredCompany = (env.SEPAY_COMPANY_CODE || "").trim().toUpperCase();
  if (!configuredCompany) issues.push("Thiếu SEPAY_COMPANY_CODE.");
  else if (configuredCompany !== companyCode.trim().toUpperCase()) issues.push("SEPAY_COMPANY_CODE không khớp mã đơn vị đang đăng nhập.");
  if (!companyCode.trim() || !configuredCompany || configuredCompany !== companyCode.trim().toUpperCase()) {
    return { config: null, issues };
  }
  const bank = (env.SEPAY_BANK || "").trim();
  const accountNumber = (env.SEPAY_ACCOUNT_NUMBER || "").trim();
  const accountName = (env.SEPAY_ACCOUNT_NAME || "").trim();
  const apiKey = (env.SEPAY_API_KEY || "").trim();
  if ((env.SEPAY_ENABLED || "").trim().toLowerCase() !== "true") issues.push("Cần đặt SEPAY_ENABLED=true.");
  if (!/^[A-Za-z0-9]{2,50}$/.test(bank)) issues.push("SEPAY_BANK phải có 2–50 ký tự chữ hoặc số, không chứa khoảng trắng.");
  if (!/^[A-Za-z0-9]{3,40}$/.test(accountNumber)) issues.push("SEPAY_ACCOUNT_NUMBER phải có 3–40 ký tự chữ hoặc số.");
  if (accountName.length < 2 || accountName.length > 150) issues.push("SEPAY_ACCOUNT_NAME phải có 2–150 ký tự.");
  if (!/^[A-Za-z0-9_-]{32,200}$/.test(apiKey)) issues.push("SEPAY_API_KEY phải có 32–200 ký tự chữ, số, dấu gạch dưới hoặc gạch ngang; dùng khóa xác thực webhook.");
  return { config: { bank, accountNumber, accountName, apiKey, enabled: issues.length === 0 }, issues };
}
