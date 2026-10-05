export function redactLogData(data: unknown) {
  if (!data || typeof data !== "object") return data;
  const sensitiveKeys = ["password", "token", "secret", "authorization", "apiKey", "refreshToken"];
  if (Array.isArray(data)) return data.map(redactLogData);
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(data)) {
    if (sensitiveKeys.some((s) => key.toLowerCase().includes(s.toLowerCase()))) {
      result[key] = "[REDACTED]";
    } else {
      result[key] = redactLogData(val);
    }
  }
  return result;
}

export const logger = {
  info: (msg: unknown, ...args: unknown[]) => console.log(typeof msg === "object" ? JSON.stringify(redactLogData(msg)) : msg, ...args),
  warn: (msg: unknown, ...args: unknown[]) => console.warn(typeof msg === "object" ? JSON.stringify(redactLogData(msg)) : msg, ...args),
  error: (msg: unknown, ...args: unknown[]) => console.error(typeof msg === "object" ? JSON.stringify(redactLogData(msg)) : msg, ...args),
};
