import type { Context } from "@/env"
import {
  EmployeeLifecycleReadRepository,
  type EmployeeLifecycleState,
} from "@/contexts/company/infrastructure/employee-lifecycle/employee-lifecycle-read-repository"
import { EmployeeLifecycleRepository } from "@/contexts/company/infrastructure/employee-lifecycle/employee-lifecycle-repository"
import { ApplicationError, NotFoundError, UnavailableError, ValidationError } from "@/lib/errors"
import { isoDate } from "@/lib/schemas"
import { resolveCompanyBusinessDate } from "@/lib/time/resolve-company-business-date"

export class GetLifecycleState {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(props: {
    employeeId: number
    asOf?: string
  }): Promise<EmployeeLifecycleState | ApplicationError> {
    const migrationStatus = await new EmployeeLifecycleRepository(this.c).migrationStatus()
    if (migrationStatus instanceof ApplicationError) return migrationStatus
    if (migrationStatus !== "verified") {
      return new UnavailableError(
        "人事ライフサイクル移行が完了していません",
        "lifecycle_migration_incomplete",
      )
    }

    let asOf = props.asOf
    if (asOf === undefined) {
      const resolved = resolveCompanyBusinessDate({
        now: this.c.env.NOW ?? new Date().toISOString(),
        timeZone: this.c.env.COMPANY_TIME_ZONE,
      })
      if (typeof resolved !== "string") {
        return new UnavailableError("会社営業日を解決できません", "company_timezone_unavailable", {
          cause: resolved,
        })
      }
      asOf = resolved
    } else if (!isoDate.safeParse(asOf).success) {
      return new ValidationError("as_of が不正です", "personnel_action_invalid_transition")
    }

    const states = await new EmployeeLifecycleReadRepository(this.c).findStatesAt(
      [props.employeeId],
      asOf,
    )
    if (states instanceof ApplicationError) return states
    return (
      states.get(props.employeeId) ??
      new NotFoundError("従業員が見つかりません", "employee_not_found")
    )
  }
}
