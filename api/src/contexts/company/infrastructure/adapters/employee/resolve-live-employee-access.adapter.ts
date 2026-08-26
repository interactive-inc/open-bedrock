import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import {
  CompanyOperationError,
  CompanyUnexpectedError,
  CompanyUnavailableError,
} from "@/contexts/company/domain/errors"

export type LiveEmployeeAccess = {
  status: "ACTIVE" | "ON_LEAVE"
  source: "employment"
  businessDate: string
}

/** canonical lifecycleだけから現在の認証可能な在籍状態を解決する。 */
async function resolveLiveEmployeeAccess(
  c: CompanyContext,
  employeeId: EmployeeId,
): Promise<LiveEmployeeAccess | null | CompanyOperationError> {
  const businessDate = resolveCompanyBusinessDate({
    now: c.env.NOW ?? new Date().toISOString(),
    timeZone: c.env.COMPANY_TIME_ZONE,
  })
  if (typeof businessDate !== "string") {
    return new CompanyUnavailableError(
      "会社営業日を解決できません",
      "company_timezone_unavailable",
      { cause: businessDate },
    )
  }

  try {
    const states = await c.env.DB.prepare(
      `SELECT status
       FROM company_employments
       WHERE employee_id = ?1
         AND hire_date <= ?2
         AND (termination_date IS NULL OR termination_date >= ?2)
         AND status IN ('ACTIVE', 'ON_LEAVE')
       ORDER BY id
       LIMIT 2`,
    )
      .bind(employeeId, businessDate)
      .all<{ status: unknown }>()
    if (!states.success) {
      return new CompanyUnexpectedError("基準日現在の在籍状態を取得できません")
    }
    if (states.results.length === 0) return null
    if (states.results.length !== 1) {
      return new CompanyUnavailableError(
        "基準日現在の在籍状態が一意ではありません",
        "lifecycle_projection_mismatch",
      )
    }

    const status = states.results[0]!.status
    if (status !== "ACTIVE" && status !== "ON_LEAVE") {
      return new CompanyUnavailableError(
        "基準日現在の在籍状態が不正です",
        "lifecycle_projection_mismatch",
      )
    }

    return { status, source: "employment", businessDate }
  } catch (cause) {
    return new CompanyUnavailableError(
      "基準日現在の在籍状態を取得できません",
      "lifecycle_projection_mismatch",
      { cause },
    )
  }
}
type Context = CompanyContext

export class ResolveLiveEmployeeAccessAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async resolveLiveEmployeeAccess(
    employeeId: EmployeeId,
  ): Promise<LiveEmployeeAccess | null | CompanyOperationError> {
    return resolveLiveEmployeeAccess(this.c, employeeId)
  }
}
