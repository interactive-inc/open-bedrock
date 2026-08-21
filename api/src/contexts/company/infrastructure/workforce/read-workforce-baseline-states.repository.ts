import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/policies/to-workforce-lifecycle-schedules.policy"
import type { WorkforceBaselineState } from "@/contexts/company/domain/definitions/workforce-schedule.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

type BaselineRow = Readonly<{
  employee_id: number
  event_on: string
  status: string
}>

/** 明示済みinitial stateを、推測した雇用期間ではなく初期状態として復元する。 */
export async function readWorkforceBaselineStates(
  database: D1Database,
): Promise<ReadonlyMap<EmployeeId, WorkforceBaselineState>> {
  const rows = await database
    .prepare(
      `SELECT employee_id, event_on, json_extract(summary_json, '$.status') AS status
         FROM personnel_actions
         WHERE kind = 'initial_state'
         ORDER BY employee_id, recorded_at, id`,
    )
    .all<BaselineRow>()
  const states = new Map<EmployeeId, WorkforceBaselineState>()
  for (const row of rows.results) {
    const employeeId = toWorkforceEmployeeId(row.employee_id)
    if (states.has(employeeId)) throw new Error("employee has duplicate lifecycle baselines")
    if (row.status !== "active" && row.status !== "leave" && row.status !== "retired") {
      throw new Error("employee lifecycle baseline status is invalid")
    }
    if (row.status === "retired") {
      states.set(employeeId, {
        asOf: restoreCalendarDate(row.event_on),
        status: "TERMINATED",
      })
    }
  }

  return states
}
