/** Shared by the login form, API and account rate limiter. */
export function normalizeLoginIdentifier(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const value = input.trim();
  if (!value || value.length > 254) return null;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return value.toLowerCase();
  if (!/^\+?[\d\s().-]+$/.test(value)) return null;
  let phone = value.replace(/[\s().-]/g, "");
  if (!/^\+?\d{8,15}$/.test(phone)) return null;
  if (/^\+?84\d{9,10}$/.test(phone)) phone = "0" + phone.replace(/^\+?84/, "");
  return phone;
}
