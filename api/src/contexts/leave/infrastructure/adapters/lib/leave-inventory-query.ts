import { uuidSchema } from "@/lib/validation/uuid.schema"
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
    const cursor = after
    if (cursor !== null && !uuidSchema.safeParse(cursor).success)
      return new Error("invalid leave request cursor")
    return {
      sql:
        cursor === null
          ? "SELECT id AS record_id FROM leave_requests ORDER BY id COLLATE BINARY LIMIT ?1"
          : "SELECT id AS record_id FROM leave_requests WHERE id COLLATE BINARY>?1 ORDER BY id COLLATE BINARY LIMIT ?2",
      values: cursor === null ? [pageSize] : [cursor, pageSize],
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
      sql:
        after === null
          ? `SELECT request_key AS record_id FROM leave_procedure_bindings ORDER BY request_key LIMIT ?1`
          : `SELECT request_key AS record_id FROM leave_procedure_bindings
            WHERE request_key>?1 ORDER BY request_key LIMIT ?2`,
      values: after === null ? [pageSize] : [after, pageSize],
      recordId: (row) => String(row.record_id),
    }
  }
  return {
    sql:
      after === null
        ? `SELECT job_id AS record_id FROM leave_decision_notifications ORDER BY job_id LIMIT ?1`
        : `SELECT job_id AS record_id FROM leave_decision_notifications
          WHERE job_id>?1 ORDER BY job_id LIMIT ?2`,
    values: after === null ? [pageSize] : [after, pageSize],
    recordId: (row) => String(row.record_id),
  }
}
