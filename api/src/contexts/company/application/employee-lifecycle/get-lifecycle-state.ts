import type { Context } from "@/env"
import { ReadWorkforceState } from "@/contexts/company/application/workforce/read-workforce-state"
import { isCalendarDate } from "@/contexts/company/domain/workforce/is-calendar-date"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/employee-lifecycle/to-workforce-lifecycle-schedules"
import {
  EmployeeLifecycleReadRepository,
  type EmployeeLifecycleState,
} from "@/contexts/company/infrastructure/employee-lifecycle/employee-lifecycle-read-repository"
import { EmployeeLifecycleRepository } from "@/contexts/company/infrastructure/employee-lifecycle/employee-lifecycle-repository"
import { EmployeeLifecycleWorkforceRepository } from "@/contexts/company/infrastructure/workforce/employee-lifecycle-workforce.repository"
import { OrganizationUnitReadRepository } from "@/contexts/company/infrastructure/workforce/organization-unit-read.repository"
import { toEmployeeLifecycleState } from "@/contexts/company/infrastructure/workforce/to-employee-lifecycle-state"
import {
  ApplicationError,
  NotFoundError,
  UnexpectedError,
  UnavailableError,
  ValidationError,
} from "@/lib/errors"
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

    if (!isCalendarDate(asOf)) {
      return new ValidationError("as_of が不正です", "personnel_action_invalid_transition")
    }

    const workforce = await new ReadWorkforceState({
      workforce: new EmployeeLifecycleWorkforceRepository(this.c),
      organization: new OrganizationUnitReadRepository(this.c.var.database),
    }).execute({ employeeId: toWorkforceEmployeeId(props.employeeId), asOf })

    if (workforce.kind === "not_found") {
      return new NotFoundError("従業員が見つかりません", "employee_not_found")
    }
    if (workforce.kind === "unavailable") {
      return new UnexpectedError("基準日現在の人事状態を取得できません", {
        cause: workforce.cause,
      })
    }
    if (workforce.kind === "invalid_schedule") {
      return new UnavailableError(
        "人事ライフサイクルの保存状態が不正です",
        "lifecycle_projection_mismatch",
        { cause: workforce.error },
      )
    }
    if (workforce.kind === "invalid_organization") {
      return new UnavailableError("会社組織の保存状態が不正です", "lifecycle_projection_mismatch", {
        cause: workforce.error,
      })
    }

    const states = await new EmployeeLifecycleReadRepository(this.c).findStatesAt(
      [props.employeeId],
      asOf,
    )
    if (states instanceof ApplicationError) return states
    const projection = states.get(props.employeeId)
    if (projection === undefined) {
      return new UnavailableError(
        "人事ライフサイクルの表示状態を解決できません",
        "lifecycle_projection_mismatch",
      )
    }

    const state = toEmployeeLifecycleState({ workforce: workforce.state, projection })

    return state instanceof Error
      ? new UnavailableError(
          "人事ライフサイクルの表示状態が共通状態と一致しません",
          "lifecycle_projection_mismatch",
          { cause: state },
        )
      : state
  }
}
