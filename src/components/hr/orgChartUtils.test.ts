import { describe, expect, it } from "vitest";
import { EmployeeNode } from "../../types";
import { filterOrgChartEmployees, getManagerForEmployee } from "./orgChartUtils";

const employees: EmployeeNode[] = [
  { id: "1", name: "Nguyễn An", role: "Giám đốc", companyName: "Doanh nghiệp An", email: "an@example.com", phone: "0901", avatar: "A", status: "online" },
  { id: "2", name: "Trần Bình", role: "Nhân viên", industry: "Kỹ thuật", email: "binh@example.com", phone: "0902", avatar: "B", parentId: "1", status: "offline" },
];

describe("org chart list helpers", () => {
  it("filters flat employees by normalized search, business and industry", () => {
    expect(filterOrgChartEmployees(employees, "NGUYEN")).toHaveLength(1);
    expect(filterOrgChartEmployees(employees, "KY THUAT")).toEqual([employees[1]]);
  });

  it("returns the direct manager or a missing-data fallback", () => {
    expect(getManagerForEmployee(employees[1], employees)?.name).toBe("Nguyễn An");
    expect(getManagerForEmployee(employees[0], employees)).toBeUndefined();
  });
});
