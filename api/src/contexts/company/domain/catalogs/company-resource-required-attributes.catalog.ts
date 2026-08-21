import type { CompanyResourceType } from "@/contexts/company/domain/catalogs/company-resource-type.catalog"

export const companyResourceRequiredAttributes = {
  "legal-entity": ["officialName"],
  "company-profile": ["displayName"],
  person: ["officialName"],
  employee: ["personId"],
  employment: ["employeeId", "status"],
  "organization-unit": ["code", "officialName", "kind"],
  assignment: ["employeeId", "employmentId", "organizationUnitId", "assignmentType"],
  "reporting-relation": ["employeeId", "managerEmployeeId"],
  position: ["code", "officialName"],
  grade: ["code", "officialName"],
  responsibility: ["code", "officialName"],
  "collective-body": ["officialName"],
  "organizational-authority": ["employeeId", "scopeType", "authority"],
  "account-employee-link": ["accountId", "employeeId"],
  "personnel-action": ["actionType"],
} as const satisfies Readonly<Record<CompanyResourceType, ReadonlyArray<string>>>
