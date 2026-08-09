import type { Context } from "@/env"
import { EmployeeLifecycleReadRepository } from "@/infrastructure/employee-lifecycle/employee-lifecycle-read-repository"
import { EmployeeLifecycleRepository } from "@/infrastructure/employee-lifecycle/employee-lifecycle-repository"
import { ApplicationError } from "@/lib/errors"
import { resolveCompanyBusinessDate } from "@/lib/time/resolve-company-business-date"

export type WorkflowAccount = { employeeId: number; accountId: number }

/** Active account and live employment are both required for an approval candidate. */
export async function filterLiveWorkflowAccounts(
  c: Context,
  candidates: ReadonlyArray<WorkflowAccount>,
): Promise<ReadonlyArray<WorkflowAccount> | Error> {
  if (candidates.length === 0) return []

  try {
    const rows = await c.env.DB.prepare(
      `SELECT DISTINCT link.employee_id AS employee_id, account.id AS account_id,
                       employee.status AS legacy_status
         FROM json_each(?1) AS candidate_json
         INNER JOIN accounts AS account
           ON account.id = json_extract(candidate_json.value, '$.accountId')
         INNER JOIN account_employee_links AS link
           ON link.account_id = account.id
          AND link.employee_id = json_extract(candidate_json.value, '$.employeeId')
         INNER JOIN employees AS employee ON employee.id = link.employee_id
         WHERE account.status = 'active'`,
    )
      .bind(JSON.stringify(candidates))
      .all<{ employee_id: number; account_id: number; legacy_status: string }>()
    const migrationStatus = await new EmployeeLifecycleRepository(c).migrationStatus()
    if (migrationStatus instanceof ApplicationError) return migrationStatus

    if (migrationStatus !== "verified") {
      return rows.results
        .filter((row) => row.legacy_status !== "retired")
        .map((row) => ({ employeeId: row.employee_id, accountId: row.account_id }))
    }

    const businessDate = resolveCompanyBusinessDate({
      now: c.env.NOW ?? new Date().toISOString(),
      timeZone: c.env.COMPANY_TIME_ZONE,
    })
    if (typeof businessDate !== "string") return businessDate
    const states = await new EmployeeLifecycleReadRepository(c).findStatesAt(
      rows.results.map((row) => row.employee_id),
      businessDate,
    )
    if (states instanceof ApplicationError) return states

    return rows.results.flatMap((row) => {
      const state = states.get(row.employee_id)
      return state !== undefined &&
        !state.archived &&
        (state.status === "active" || state.status === "leave")
        ? [{ employeeId: row.employee_id, accountId: row.account_id }]
        : []
    })
  } catch (error) {
    return error instanceof Error ? error : new Error("failed to resolve live workflow accounts")
  }
}
