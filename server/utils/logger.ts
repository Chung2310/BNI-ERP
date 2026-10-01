export function redactLogData(data: any): any {
  if (!data || typeof data !== "object") return data;
  const sensitiveKeys = ["password", "token", "secret", "authorization", "apiKey", "refreshToken"];
  if (Array.isArray(data)) return data.map(redactLogData);
  const result: Record<string, any> = {};
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
  info: (msg: any, ...args: any[]) => console.log(typeof msg === "object" ? JSON.stringify(redactLogData(msg)) : msg, ...args),
  warn: (msg: any, ...args: any[]) => console.warn(typeof msg === "object" ? JSON.stringify(redactLogData(msg)) : msg, ...args),
  error: (msg: any, ...args: any[]) => console.error(typeof msg === "object" ? JSON.stringify(redactLogData(msg)) : msg, ...args),
};
