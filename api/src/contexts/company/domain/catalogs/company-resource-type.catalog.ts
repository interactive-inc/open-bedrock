export const companyResourceTypes = [
  "legal-entity",
  "company-profile",
  "person",
  "employee",
  "employment",
  "organization-unit",
  "assignment",
  "reporting-relation",
  "position",
  "grade",
  "responsibility",
  "collective-body",
  "organizational-authority",
  "account-employee-link",
  "personnel-action",
] as const

export type CompanyResourceType = (typeof companyResourceTypes)[number]
