import type { CalendarDate } from "@/contexts/company/domain/workforce/calendar-date"

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
export type CompanyResourceState = "active" | "void"
export type CompanyJson = null | boolean | number | string | CompanyJson[] | CompanyJsonObject
export type CompanyJsonObject = { readonly [key: string]: CompanyJson }

export type CompanyResource = Readonly<{
  organizationId: string
  type: CompanyResourceType
  id: string
  revision: number
  state: CompanyResourceState
  effectiveFrom: CalendarDate
  effectiveTo: CalendarDate | null
  attributes: CompanyJsonObject
}>

export type CompanyResourceChange = Readonly<{
  commandId: string
  expectedRevision: number
  actorAccountId: string
  reason: string
  recordedAt: number
  resources: ReadonlyArray<CompanyResource>
}>
