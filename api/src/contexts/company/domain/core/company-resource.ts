import {
  isCalendarDate,
  type CalendarDate,
} from "@/contexts/company/domain/workforce/calendar-date"

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

export type CompanyResourceValidationCode =
  | "invalid_identifier"
  | "invalid_revision"
  | "invalid_period"
  | "invalid_attributes"
  | "invalid_resource"
  | "invalid_change"
  | "invalid_query"

export class CompanyResourceValidationError extends Error {
  constructor(readonly code: CompanyResourceValidationCode) {
    super(code)
    this.name = "CompanyResourceValidationError"
  }
}

const requiredStringAttributes = {
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

export function isCompanyResourceType(value: string): value is CompanyResourceType {
  return companyResourceTypes.some((type) => type === value)
}

export function isCompanyIdentifier(value: string): boolean {
  return value.length >= 1 && value.length <= 255 && value.trim() === value && !/\s/.test(value)
}

function isCompanyJson(value: unknown, depth = 0): value is CompanyJson {
  if (depth > 20) return false
  if (value === null || typeof value === "boolean" || typeof value === "string") return true
  if (typeof value === "number") return Number.isFinite(value)
  if (Array.isArray(value))
    return value.length <= 1_000 && value.every((item) => isCompanyJson(item, depth + 1))
  if (typeof value !== "object") return false

  const entries = Object.entries(value)
  return (
    entries.length <= 1_000 &&
    entries.every(
      ([key, item]) => key.length >= 1 && key.length <= 255 && isCompanyJson(item, depth + 1),
    )
  )
}

function hasRequiredAttributes(resource: CompanyResource): boolean {
  return requiredStringAttributes[resource.type].every((key) => {
    const value = resource.attributes[key]
    return (
      typeof value === "string" &&
      value.length >= 1 &&
      value.length <= 2_000 &&
      value.trim() === value
    )
  })
}

export function validateCompanyResource(
  resource: CompanyResource,
): CompanyResourceValidationError | null {
  if (!isCompanyIdentifier(resource.organizationId) || !isCompanyIdentifier(resource.id)) {
    return new CompanyResourceValidationError("invalid_identifier")
  }
  if (!Number.isSafeInteger(resource.revision) || resource.revision < 1) {
    return new CompanyResourceValidationError("invalid_revision")
  }
  if (
    !isCalendarDate(resource.effectiveFrom) ||
    (resource.effectiveTo !== null &&
      (!isCalendarDate(resource.effectiveTo) || resource.effectiveTo <= resource.effectiveFrom))
  ) {
    return new CompanyResourceValidationError("invalid_period")
  }
  if (!isCompanyJson(resource.attributes)) {
    return new CompanyResourceValidationError("invalid_attributes")
  }
  if (!hasRequiredAttributes(resource)) {
    return new CompanyResourceValidationError("invalid_resource")
  }
  return null
}

export function validateCompanyResourceChange(
  change: CompanyResourceChange,
): CompanyResourceValidationError | null {
  if (
    !isCompanyIdentifier(change.commandId) ||
    !isCompanyIdentifier(change.actorAccountId) ||
    !Number.isSafeInteger(change.expectedRevision) ||
    change.expectedRevision < 0 ||
    !Number.isSafeInteger(change.recordedAt) ||
    change.recordedAt < 0 ||
    change.reason.length < 1 ||
    change.reason.length > 2_000 ||
    change.reason.trim() !== change.reason ||
    change.resources.length < 1 ||
    change.resources.length > 100
  ) {
    return new CompanyResourceValidationError("invalid_change")
  }

  const organizationId = change.resources[0]?.organizationId
  const identities = new Set<string>()
  for (const resource of change.resources) {
    const error = validateCompanyResource(resource)
    if (error !== null) return error
    if (resource.organizationId !== organizationId) {
      return new CompanyResourceValidationError("invalid_change")
    }
    const identity = `${resource.type}\u0000${resource.id}`
    if (identities.has(identity)) return new CompanyResourceValidationError("invalid_change")
    identities.add(identity)
  }

  return null
}
