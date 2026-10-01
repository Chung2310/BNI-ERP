import { test, expect } from "vitest";
import { ApiClientError, parseApiErrorResponse } from "./apiClientError";

test("parses the standard API error envelope", async () => {
  const response = new Response(JSON.stringify({ ok: false, error: { code: "PARTNER_PHONE_ALREADY_EXISTS", message: "Số điện thoại đã tồn tại.", details: { field: "phone" }, requestId: "req-1" } }), { status: 409, headers: { "content-type": "application/json" } });
  const error = await parseApiErrorResponse(response);
  expect(error instanceof ApiClientError).toBe(true);
  expect(error.status).toBe(409);
  expect(error.code).toBe("PARTNER_PHONE_ALREADY_EXISTS");
  expect(error.message).toBe("Số điện thoại đã tồn tại.");
  expect(error.details).toEqual({ field: "phone" });
  expect(error.requestId).toBe("req-1");
});

test("parses worker-management success=false error objects", async () => {
  const response = new Response(JSON.stringify({ success: false, error: { code: "POLICY_NOT_ACTIVE", message: "Chính sách hoa hồng chưa hoạt động." } }), { status: 409, headers: { "content-type": "application/json" } });
  const error = await parseApiErrorResponse(response);
  expect(error.code).toBe("POLICY_NOT_ACTIVE");
  expect(error.message).toBe("Chính sách hoa hồng chưa hoạt động.");
});

test("uses a safe fallback for malformed and non-JSON responses", async () => {
  const malformed = new Response("gateway down", { status: 502, headers: { "content-type": "text/plain" } });
  const malformedError = await parseApiErrorResponse(malformed);
  expect(malformedError.code).toBe("UNKNOWN_API_ERROR");
  expect(malformedError.message).toBe("Yêu cầu không thể xử lý.");
  expect(malformedError.status).toBe(malformed.status);

  const legacy = new Response(JSON.stringify({ message: "legacy secret" }), { status: 500, headers: { "content-type": "application/json" } });
  const legacyError = await parseApiErrorResponse(legacy);
  expect(legacyError.code).toBe("API_ERROR");
  expect(legacyError.message).toBe("legacy secret");
  expect(legacyError.status).toBe(legacy.status);
});
