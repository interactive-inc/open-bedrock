import type { Context } from "@/env"
import type { WorkflowAccount } from "@/contexts/request/domain/workflow-approver"
import { EmployeeLifecycleReadRepository } from "@/contexts/company/infrastructure/employee-lifecycle/employee-lifecycle-read-repository"
import { EmployeeLifecycleRepository } from "@/contexts/company/infrastructure/employee-lifecycle/employee-lifecycle-repository"
import { ApplicationError } from "@/lib/errors"
import { resolveCompanyBusinessDate } from "@/lib/time/resolve-company-business-date"
import type { AccountId } from "@system/domain/auth/account-id"

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
         INNER JOIN system_accounts AS account
           ON account.id = json_extract(candidate_json.value, '$.accountId')
         INNER JOIN account_employee_links AS link
           ON CAST(link.account_id AS TEXT) = account.id
          AND link.employee_id = json_extract(candidate_json.value, '$.employeeId')
         INNER JOIN employees AS employee ON employee.id = link.employee_id
         WHERE account.status = 'active'`,
    )
      .bind(JSON.stringify(candidates))
      .all<{ employee_id: number; account_id: AccountId; legacy_status: string }>()
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
