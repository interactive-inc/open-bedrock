import { ReadWorkforceState } from "@/contexts/company/application/workforce/read-workforce-state"
import { toWorkforceEmployeeId } from "@/contexts/company-compatibility/domain/employee-lifecycle/to-workforce-lifecycle-schedules"
import { restoreCalendarDate } from "@/contexts/company/domain/workforce/restore-calendar-date"
import { EmployeeLifecycleRepository } from "@/contexts/company-compatibility/infrastructure/employee-lifecycle/employee-lifecycle-repository"
import { EmployeeLifecycleWorkforceRepository } from "@/contexts/company-compatibility/infrastructure/workforce/employee-lifecycle-workforce.repository"
import { OrganizationUnitReadRepository } from "@/contexts/company-compatibility/infrastructure/workforce/organization-unit-read.repository"
import type { Context } from "@/env"
import { UnavailableError } from "@/lib/errors"

export type EmployeeActiveResult =
  | { valid: true }
  | {
      valid: false
      code: "not_found" | "archived" | "not_active" | "retired" | "department_archived"
      message: string
    }

/** canonical Workforce snapshotだけから指定時点の在籍有効性を検証する。 */
export async function validateEmployeeActive(
  c: Context,
  employeeId: number,
  businessDate: string,
): Promise<EmployeeActiveResult | Error> {
  const migrationStatus = await new EmployeeLifecycleRepository(c).migrationStatus()
  if (migrationStatus instanceof Error) return migrationStatus
  if (migrationStatus !== "verified") {
    return new UnavailableError(
      "Company migrationが完了していません",
      "company_migration_incomplete",
    )
  }

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
    return new UnavailableError(
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
