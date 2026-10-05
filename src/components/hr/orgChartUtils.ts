import { EmployeeNode } from "../../types";

const normalizeOrgChartText = (value?: string): string => String(value || "")
  .trim()
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "");

export const filterOrgChartEmployees = (
  employees: EmployeeNode[],
  searchQuery: string,
): EmployeeNode[] => {
  const query = normalizeOrgChartText(searchQuery);
  return employees.filter((employee) => {
    const matchesSearch = !query || [employee.name, employee.role, employee.companyName, employee.industry, employee.email, employee.phone]
      .some((value) => normalizeOrgChartText(value).includes(query));
    return matchesSearch;
  });
};

export const getManagerForEmployee = (employee: EmployeeNode, employees: EmployeeNode[]): EmployeeNode | undefined => {
  return employee.parentId ? employees.find((candidate) => candidate.id === employee.parentId) : undefined;
};
