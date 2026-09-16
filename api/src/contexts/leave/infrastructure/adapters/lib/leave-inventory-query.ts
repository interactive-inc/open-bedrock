import {
  decodeLeaveBalanceRecordId,
  encodeLeaveBalanceRecordId,
  type LeaveRecordKind,
} from "@/contexts/leave/domain/definitions/leave-record-kind.definition"

type Query = Readonly<{
  sql: string
  values: ReadonlyArray<string | number | null>
  recordId: (row: Record<string, unknown>) => string
}>

/** 台帳の主キー順と次ページのカーソルを同じ形で表す。 */
export function leaveInventoryQuery(
  recordKind: LeaveRecordKind,
  after: string | null,
  limit: number,
): Query | Error {
  const pageSize = limit + 1
  if (recordKind === "leave-request-record") {
    const cursor = after === null ? 0 : Number(after)
    if (!Number.isSafeInteger(cursor) || cursor < 0 || (after !== null && String(cursor) !== after))
      return new Error("invalid leave request cursor")
    return {
      sql: "SELECT id AS record_id FROM leave_requests WHERE id>?1 ORDER BY id LIMIT ?2",
      values: [cursor, pageSize],
      recordId: (row) => String(row.record_id),
    }
  }
  if (recordKind === "leave-balance-record") {
    const cursor = after === null ? null : decodeLeaveBalanceRecordId(after)
    if (after !== null && cursor === null) return new Error("invalid leave balance cursor")
    return {
      sql: `SELECT employee_id, fiscal_year, leave_type FROM leave_balances
        WHERE (?1 IS NULL OR (employee_id,fiscal_year,leave_type) > (?1,?2,?3))
        ORDER BY employee_id,fiscal_year,leave_type LIMIT ?4`,
      values: [
        cursor?.employeeId ?? null,
        cursor?.fiscalYear ?? null,
        cursor?.leaveType ?? null,
        pageSize,
      ],
      recordId: (row) =>
        encodeLeaveBalanceRecordId(
          String(row.employee_id),
          String(row.fiscal_year),
          String(row.leave_type),
        ),
    }
  }
  if (recordKind === "leave-procedure-binding-record") {
    return {
      sql: `SELECT request_key AS record_id FROM leave_procedure_bindings
        WHERE request_key>?1 ORDER BY request_key LIMIT ?2`,
      values: [after ?? "", pageSize],
      recordId: (row) => String(row.record_id),
    }
  }
  return {
    sql: `SELECT job_id AS record_id FROM leave_decision_notifications
      WHERE job_id>?1 ORDER BY job_id LIMIT ?2`,
    values: [after ?? "", pageSize],
    recordId: (row) => String(row.record_id),
  }
}
