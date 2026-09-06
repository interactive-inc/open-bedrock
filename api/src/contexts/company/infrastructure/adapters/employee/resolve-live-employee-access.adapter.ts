import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import { CompanyOperationError, CompanyUnavailableError } from "@/contexts/company/domain/errors"
import { companyEmploymentStateSql } from "@/contexts/company/infrastructure/adapters/employee/lib/company-employment-state-sql"

export type LiveEmployeeAccess = {
  status: "ACTIVE" | "ON_LEAVE"
  source: "employment"
  businessDate: string
}

type Context = Readonly<{ env: CompanyContext["env"] }>
type EmploymentStateRow = Readonly<{
  status: unknown
  employment_starts_on: string
  employment_ends_on: string | null
  status_starts_on: string | null
  status_ends_on: string | null
}>

/** 会社営業日に有効な雇用・状態の期間履歴からアクセス資格を解決する。 */
export class ResolveLiveEmployeeAccessAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async resolveLiveEmployeeAccess(
    employeeId: EmployeeId,
  ): Promise<LiveEmployeeAccess | null | CompanyOperationError> {
    const businessDate = resolveCompanyBusinessDate({
      now: this.c.env.NOW ?? new Date().toISOString(),
      timeZone: this.c.env.COMPANY_TIME_ZONE,
    })
    if (businessDate instanceof Error) {
      return new CompanyUnavailableError(
        "会社営業日を解決できません",
        "company_timezone_unavailable",
        { cause: businessDate },
      )
    }

    try {
      const states = await this.c.env.DB.prepare(
        `${companyEmploymentStateSql()}
         SELECT status, employment_starts_on, employment_ends_on,
                status_starts_on, status_ends_on
         FROM current_employment_states
         WHERE employee_id = ?2
         ORDER BY employment_id, status_period_id
         LIMIT 2`,
      )
        .bind(businessDate, employeeId)
        .all<EmploymentStateRow>()
      if (!states.success) return this.unavailable()
      if (states.results.length === 0) return null
      if (states.results.length !== 1) return this.unavailable()

      const state = states.results[0]
      if (state === undefined || !this.isValidState(state)) return this.unavailable()

      return {
        status: state.status === "active" ? "ACTIVE" : "ON_LEAVE",
        source: "employment",
        businessDate,
      }
    } catch (cause) {
      return this.unavailable(cause)
    }
  }

  private isValidState(state: EmploymentStateRow): boolean {
    if (state.status !== "active" && state.status !== "leave") return false
    if (state.status_starts_on === null || state.status_starts_on < state.employment_starts_on)
      return false
    if (state.employment_ends_on === null) return true

    return state.status_ends_on !== null && state.status_ends_on <= state.employment_ends_on
  }

  private unavailable(cause?: unknown): CompanyUnavailableError {
    return new CompanyUnavailableError(
      "基準日現在の在籍状態を一意に解決できません",
      "lifecycle_projection_mismatch",
      { cause },
    )
  }
}
