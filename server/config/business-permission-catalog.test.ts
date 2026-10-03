import { expect, test } from "vitest";
import { PERMISSION_CODES } from "./permission-catalog";

test("business and sensitive modules have registered permission pairs", () => {
  for (const feature of ["people", "relationship", "meetings", "resource", "chat", "access"]) {
    expect(PERMISSION_CODES, `${feature}:read missing`).toContain(`${feature}:read`);
    expect(PERMISSION_CODES, `${feature}:manage missing`).toContain(`${feature}:manage`);
  }
});
