import {
  decodeLeaveBalanceRecordId,
  type LeaveRecordKind,
} from "@/contexts/leave/domain/definitions/leave-record-kind.definition"
import { z } from "zod"

type SnapshotQuery = Readonly<{ sql: string; values: ReadonlyArray<string | number> }>

function positiveId(recordId: string): number | null {
  const parsed = z.coerce.number().int().positive().safe().safeParse(recordId)
  return parsed.success && String(parsed.data) === recordId ? parsed.data : null
}

export function leaveSnapshotQuery(
  recordKind: LeaveRecordKind,
  recordId: string,
): SnapshotQuery | Error {
  if (recordKind === "leave-request-record") {
    const id = positiveId(recordId)
    if (id === null) return new Error("invalid leave request id")
    return {
      sql: `SELECT json_object('format','leave-request-record','version',1,'request',json_object(
        'id',id,'employee_id',employee_id,'leave_type',leave_type,'start_date',start_date,
        'end_date',end_date,'days',days,'reason',reason,'status',status,'approver_id',approver_id,
        'decided_comment',decided_comment,'created_at',created_at,'unit',unit,'hours',hours,
        'consumed_days',consumed_days,'previous_leave_request_id',previous_leave_request_id))
        AS snapshot_json FROM leave_requests WHERE id=?1`,
      values: [id],
    }
  }
  if (recordKind === "leave-balance-record") {
    const key = decodeLeaveBalanceRecordId(recordId)
    if (key === null) return new Error("invalid leave balance id")
    return {
      sql: `SELECT json_object('format','leave-balance-record','version',1,'balance',json_object(
        'employee_id',employee_id,'fiscal_year',fiscal_year,'leave_type',leave_type,
        'granted_days',granted_days,'used_days',used_days,'remaining_days',remaining_days))
        AS snapshot_json FROM leave_balances
        WHERE employee_id=?1 AND fiscal_year=?2 AND leave_type=?3`,
      values: [key.employeeId, key.fiscalYear, key.leaveType],
    }
  }
  if (recordKind === "leave-procedure-binding-record") {
    if (!z.string().trim().min(1).max(255).safeParse(recordId).success)
      return new Error("invalid leave procedure binding id")
    return {
      sql: `SELECT json_object('format','leave-procedure-binding-record','version',1,'binding',json_object(
        'request_key',request_key,'leave_request_id',leave_request_id,
        'previous_leave_request_id',previous_leave_request_id,'application_id',application_id,
        'series_id',series_id,'case_id',case_id,'proposal_digest',proposal_digest,
        'created_at',created_at)) AS snapshot_json
        FROM leave_procedure_bindings WHERE request_key=?1`,
      values: [recordId],
    }
  }
  if (!z.string().trim().min(1).max(255).safeParse(recordId).success)
    return new Error("invalid leave decision notification id")
  return {
    sql: `SELECT json_object('format','leave-decision-notification-record','version',1,
      'notification',json_object('job_id',job_id,'leave_request_id',leave_request_id,
      'decision_audit_id',decision_audit_id,'payload_json',payload_json)) AS snapshot_json
      FROM leave_decision_notifications WHERE job_id=?1`,
    values: [recordId],
  }
}
