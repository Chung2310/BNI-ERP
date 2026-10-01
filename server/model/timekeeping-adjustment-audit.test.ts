import { describe, expect, it } from "vitest";
import { TimekeepingLogModel } from "./timekeeping.model";
import { TimekeepingAdjustmentAuditModel } from "./timekeeping-adjustment-audit.model";

describe("attendance adjustment persistence", () => {
  it("stores manual adjustment metadata on attendance logs", () => {
    expect(TimekeepingLogModel.schema.path("manuallyAdjusted")).toBeTruthy();
    expect(TimekeepingLogModel.schema.path("adjustedBy")).toBeTruthy();
    expect(TimekeepingLogModel.schema.path("adjustmentReason")).toBeTruthy();
  });

  it("stores before/after audit entries", () => {
    expect(TimekeepingAdjustmentAuditModel.schema.path("before")).toBeTruthy();
    expect(TimekeepingAdjustmentAuditModel.schema.path("after")).toBeTruthy();
    expect(TimekeepingAdjustmentAuditModel.schema.path("reason")).toBeTruthy();
  });
});
