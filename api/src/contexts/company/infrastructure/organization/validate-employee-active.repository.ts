import { ReadWorkforceState } from "@/contexts/company/infrastructure/workforce/read-workforce-state.repository"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/policies/to-workforce-lifecycle-schedules.policy"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { EmployeeLifecycleWorkforceRepository } from "@/contexts/company/infrastructure/workforce/employee-lifecycle-workforce.repository"
import { OrganizationUnitReadRepository } from "@/contexts/company/infrastructure/workforce/organization-unit-read.repository"
import type { CompanyContext } from "@/contexts/company/infrastructure/configuration/company-context.repository"
import { CompanyUnavailableError } from "@/contexts/company/domain/errors"

export type EmployeeActiveResult =
  | { valid: true }
  | {
      valid: false
      code: "not_found" | "archived" | "not_active" | "retired" | "department_archived"
      message: string
    }

/** canonical Workforce snapshotだけから指定時点の在籍有効性を検証する。 */
export async function validateEmployeeActive(
  c: CompanyContext,
  employeeId: number,
  businessDate: string,
): Promise<EmployeeActiveResult | Error> {
  const state = await new ReadWorkforceState({
    workforce: new EmployeeLifecycleWorkforceRepository(c),
    organization: new OrganizationUnitReadRepository(c.var.database),
  }).execute({
    employeeId: toWorkforceEmployeeId(employeeId),
    asOf: restoreCalendarDate(businessDate),
  })
  if (state.kind === "not_found") {
    return { valid: false, code: "not_found", message: "employee not found" }
  }
  if (state.kind !== "found") {
    return new CompanyUnavailableError(
      "Company workforceを検証できません",
      "company_workforce_unavailable",
      state.kind === "unavailable" ? { cause: state.cause } : { cause: state.error },
    )
  }
  if (state.state.status !== "ACTIVE" && state.state.status !== "ON_LEAVE") {
    return { valid: false, code: "not_active", message: "employee is not active" }
  }

  return { valid: true }
}
