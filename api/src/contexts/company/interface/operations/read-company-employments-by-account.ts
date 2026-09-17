import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import type { EmploymentStatus } from "@/contexts/company/domain/definitions/employment-status.definition"
import { CompanyResourceEntity } from "@/contexts/company/domain/entities/company-resource.entity"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { readCompanyEmploymentsByEmployee } from "@/contexts/company/interface/operations/read-company-employments-by-employee"

export type CompanyEmploymentsByAccount = Readonly<{
  organizationRevision: number
  employmentIds: ReadonlyArray<string>
  employmentStatusesById: ReadonlyMap<string, EmploymentStatus>
}>

/** Account 対応と雇用を、同じ会社版・有効日で解決する公開境界。 */
export async function readCompanyEmploymentsByAccount(
  input: Readonly<{
    database: D1Database
    organizationId: string
    accountId: string
    effectiveOn: CalendarDate
    includeEndedEmployments?: boolean
    organizationRevision?: number
  }>,
): Promise<CompanyEmploymentsByAccount | Error> {
  if (
    !CompanyResourceEntity.isIdentifier(input.organizationId) ||
    !CompanyResourceEntity.isIdentifier(input.accountId)
  ) {
    return new Error("Invalid Company Account employment query")
  }

  const links = await new D1CompanyResourceRepository({
    database: input.database,
  }).findMany({
    organizationId: input.organizationId,
    types: ["account-employee-link"],
    accountLinkAccountIds: [input.accountId],
    effectiveOn: input.effectiveOn,
    organizationRevision: input.organizationRevision,
  })
  if (!links.ok) return asError(links.cause)

  if (links.resources.length > 1) return new Error("Company Account employee link is ambiguous")
  const link = links.resources[0]
  if (link === undefined) {
    return {
      organizationRevision: links.organizationRevision,
      employmentIds: [],
      employmentStatusesById: new Map(),
    }
  }
  const employeeId = link.readText("employeeId")
  if (link.readText("accountId") !== input.accountId || employeeId === null) {
    return new Error("Company Account employee link is incomplete")
  }

  const employments = await readCompanyEmploymentsByEmployee({
    database: input.database,
    organizationId: input.organizationId,
    employeeIds: [employeeId],
    effectiveOn: input.effectiveOn,
    includeEndedEmployments: input.includeEndedEmployments,
    organizationRevision: links.organizationRevision,
  })
  if (employments instanceof Error) return employments
  return {
    organizationRevision: links.organizationRevision,
    employmentIds: [...employments.employmentIdsByEmployee.values()].flat(),
    employmentStatusesById: employments.employmentStatusesById,
  }
}

function asError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error("Company Account employment read failed")
}
