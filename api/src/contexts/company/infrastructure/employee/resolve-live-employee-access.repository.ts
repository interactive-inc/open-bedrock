import type { CompanyContext } from "@/contexts/company/infrastructure/configuration/company-context.repository"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/values/resolve-company-business-date.definition"
import {
  CompanyOperationError,
  CompanyUnexpectedError,
  CompanyUnavailableError,
} from "@/contexts/company/domain/errors"

export type LiveEmployeeAccess = {
  status: "active" | "leave"
  source: "lifecycle"
  businessDate: string
}

/** canonical lifecycleだけから現在の認証可能な在籍状態を解決する。 */
export async function resolveLiveEmployeeAccess(
  c: CompanyContext,
  employeeId: number,
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
      `WITH current_employment AS (
         SELECT employment.period_id
         FROM employment_period_versions AS employment
         WHERE employment.employee_id = ?1
           AND employment.is_void = 0
           AND employment.starts_on <= ?2
           AND (employment.ends_on IS NULL OR ?2 < employment.ends_on)
           AND employment.revision = (
             SELECT max(candidate.revision)
             FROM employment_period_versions AS candidate
             WHERE candidate.period_id = employment.period_id
           )
       )
       SELECT status.status
       FROM current_employment AS employment
       JOIN employee_status_period_versions AS status
         ON status.employment_period_id = employment.period_id
        AND status.employee_id = ?1
       WHERE status.is_void = 0
         AND status.starts_on <= ?2
         AND (status.ends_on IS NULL OR ?2 < status.ends_on)
         AND status.revision = (
           SELECT max(candidate.revision)
           FROM employee_status_period_versions AS candidate
           WHERE candidate.period_id = status.period_id
         )
       ORDER BY employment.period_id, status.period_id
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
    if (status !== "active" && status !== "leave") {
      return new CompanyUnavailableError(
        "基準日現在の在籍状態が不正です",
        "lifecycle_projection_mismatch",
      )
    }

    return { status, source: "lifecycle", businessDate }
  } catch (cause) {
    return new CompanyUnavailableError(
      "基準日現在の在籍状態を取得できません",
      "lifecycle_projection_mismatch",
      { cause },
    )
  }
}
