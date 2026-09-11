import type { LeaveProcedureStatus } from "@/contexts/leave/domain/definitions/leave-procedure.definition"
import { sql } from "drizzle-orm"

/** 一覧の表示・絞り込み・件数を同じ案件状態から導出する。 */
export const leaveProcedureStatusSql = sql<LeaveProcedureStatus>`coalesce((
  SELECT CASE
    WHEN workflow_case.status IN ('returned', 'cancelled') THEN workflow_case.status
    WHEN leave_requests.status = 'pending' AND workflow_case.status IN ('approved', 'rejected') THEN 'awaiting_execution'
    ELSE leave_requests.status END
  FROM leave_procedure_bindings binding
  JOIN system_cases workflow_case ON workflow_case.id = binding.case_id
  WHERE binding.leave_request_id = leave_requests.id
), CASE WHEN leave_requests.status = 'pending' THEN 'draft' ELSE leave_requests.status END)`
