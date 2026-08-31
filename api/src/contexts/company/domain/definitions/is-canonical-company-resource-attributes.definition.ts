import type { CompanyResourceType } from "@/contexts/company/domain/catalogs/company-resource-type.catalog"
import { z } from "zod"

const identifier = z.string().regex(/^\S{1,255}$/)
const text = z.string().trim().min(1).max(2_000)
const code = z.string().trim().min(1).max(255)
const placeCode = z.string().regex(/^[A-Z0-9][A-Z0-9._-]{0,63}$/)

const resourceAttributeSchemas = {
  "legal-entity": z
    .object({
      officialName: text,
      jurisdictionCountryCode: z.string().regex(/^[A-Z]{2}$/),
      registrationNumber: code.nullable(),
      defaultCurrencyCode: z.string().regex(/^[A-Z]{3}$/),
    })
    .strict(),
  "company-profile": z
    .object({
      displayName: text,
      locale: z.string().regex(/^[a-z]{2,3}(?:-[A-Z]{2})?$/),
      timeZone: z.string().regex(/^(?:UTC|[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)+)$/),
      fiscalYearStartMonth: z.number().int().min(1).max(12),
    })
    .strict(),
  site: z
    .object({
      code: placeCode,
      officialName: text,
      legalEntityId: identifier,
      kind: z.enum(["physical", "virtual"]),
      timeZone: z.string().regex(/^(?:UTC|[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)+)$/),
      countryCode: z.string().regex(/^[A-Z]{2}$/),
    })
    .strict(),
  workplace: z
    .object({
      code: placeCode,
      officialName: text,
      siteId: identifier,
      kind: z.enum(["office", "store", "plant", "warehouse", "remote", "other"]),
      organizationUnitId: identifier.nullable().optional(),
    })
    .strict(),
  person: z
    .object({
      officialName: text,
      email: z.email().nullable().optional(),
      phone: code.nullable().optional(),
    })
    .strict(),
  employee: z
    .object({
      personId: identifier,
      employeeCode: code.nullable().optional(),
    })
    .strict(),
  employment: z
    .object({
      employeeId: identifier,
      status: z.enum(["ACTIVE", "ON_LEAVE", "TERMINATED"]),
      employmentType: code.optional(),
      officialName: text.optional(),
    })
    .strict(),
  "organization-unit": z
    .object({
      organizationUnitId: identifier,
      code: z.string().trim().min(1).max(64),
      officialName: z.string().trim().min(1).max(200),
      kind: z.enum(["COMPANY", "DIVISION", "DEPARTMENT", "TEAM", "OTHER"]),
      parentOrganizationUnitId: identifier.nullable(),
    })
    .strict(),
  assignment: z
    .object({
      employeeId: identifier,
      employmentId: identifier,
      organizationUnitId: identifier,
      assignmentType: z.enum(["PRIMARY", "CONCURRENT"]),
      positionTitle: z.string().trim().min(1).max(200).nullable().optional(),
    })
    .strict(),
  "reporting-relation": z
    .object({
      employeeId: identifier,
      managerEmployeeId: identifier,
      organizationUnitId: identifier,
    })
    .strict(),
  job: z.object({ code, officialName: text }).strict(),
  position: z
    .object({ code, officialName: text, jobId: identifier.nullable().optional() })
    .strict(),
  grade: z.object({ code, officialName: text }).strict(),
  "organizational-office": z
    .object({
      code,
      officialName: text,
      organizationUnitId: identifier,
      positionId: identifier,
    })
    .strict(),
  "office-assignment": z
    .object({
      employeeId: identifier,
      employmentId: identifier,
      organizationalOfficeId: identifier,
    })
    .strict(),
  responsibility: z.object({ code, officialName: text }).strict(),
  "authority-scope": z.discriminatedUnion("scopeType", [
    z.object({ scopeType: z.literal("organization-unit"), scopeId: identifier }).strict(),
    z.object({ scopeType: z.literal("legal-entity"), scopeId: identifier }).strict(),
    z.object({ scopeType: z.literal("site"), scopeId: identifier }).strict(),
    z.object({ scopeType: z.literal("workplace"), scopeId: identifier }).strict(),
    z.object({ scopeType: z.literal("region"), regionCode: code }).strict(),
    z
      .object({
        scopeType: z.literal("amount"),
        currencyCode: z.string().regex(/^[A-Z]{3}$/),
        minimumAmount: z.number().finite().nonnegative().nullable(),
        maximumAmount: z.number().finite().positive().nullable(),
      })
      .strict()
      .refine(
        (scope) =>
          scope.minimumAmount === null ||
          scope.maximumAmount === null ||
          scope.minimumAmount <= scope.maximumAmount,
      ),
  ]),
  "responsibility-assignment": z
    .object({
      responsibilityId: identifier,
      holderType: z.enum(["employee", "organizational-office", "collective-body"]),
      holderId: identifier,
      authorityScopeId: identifier.nullable(),
      delegationAllowed: z.boolean(),
    })
    .strict(),
  "collective-body": z
    .object({
      code,
      officialName: text,
      quorumType: z.enum(["count", "percentage"]),
      quorumValue: z.number().int().positive().max(100),
      decisionRule: z.enum(["unanimity", "majority", "qualified-majority"]),
    })
    .strict(),
  "collective-body-membership": z
    .object({
      collectiveBodyId: identifier,
      employeeId: identifier,
      role: z.enum(["chair", "member", "secretary"]),
      voting: z.boolean(),
    })
    .strict(),
  "organizational-authority": z
    .object({
      employeeId: identifier,
      employmentId: identifier,
      scopeType: z.enum(["organization-unit", "authority-scope"]),
      scopeId: identifier,
      authority: code,
    })
    .strict(),
  "account-employee-link": z.object({ accountId: identifier, employeeId: identifier }).strict(),
  "personnel-action": z.object({ actionType: code }).strict(),
} satisfies Readonly<Record<CompanyResourceType, z.ZodType>>

/** Company resourceの種別ごとに閉じた属性契約だけを受理する。 */
export function isCanonicalCompanyResourceAttributes(
  type: CompanyResourceType,
  attributes: unknown,
): boolean {
  return resourceAttributeSchemas[type].safeParse(attributes).success
}
