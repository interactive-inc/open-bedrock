import { leaveProcedureDecisionTargetSchema } from "@/contexts/leave/domain/definitions/leave-procedure-decision-target.definition"
import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import {
  leaveTypeSchema,
  leaveUnitSchema,
} from "@/contexts/leave/domain/definitions/leave-request.definition"
import { z } from "zod"

/** 休暇申請 1 件のレスポンス（作成・承認・却下時）。approver_id と decided_comment を含む。 */
export const zAppLeaveRequest = z.object({
  id: z.number(),
  employee_id: zEmployeeId,
  leave_type: leaveTypeSchema,
  start_date: z.string(),
  end_date: z.string(),
  days: z.number(),
  unit: leaveUnitSchema,
  hours: z.number().nullable(),
  reason: z.string().nullable(),
  status: z.enum(["pending", "approved", "rejected"]),
  approver_id: zEmployeeId.nullable(),
  decided_comment: z.string().nullable(),
  created_at: z.string(),
})

/** 休暇申請の詳細レスポンス（GET/PUT /requests/:id）。approver_id と decided_comment を含まない。 */
export const zAppLeaveRequestDetail = z.object({
  consumed_days: z.number(),
  id: z.number(),
  employee_id: zEmployeeId,
  leave_type: leaveTypeSchema,
  start_date: z.string(),
  end_date: z.string(),
  days: z.number(),
  unit: leaveUnitSchema,
  hours: z.number().nullable(),
  reason: z.string().nullable(),
  status: z.enum(["pending", "approved", "rejected"]),
  created_at: z.string(),
})

/** 本人の休暇申請一覧 1 件（GET /requests/me）。 */
export const zAppLeaveRequestSummary = z.object({
  id: z.number(),
  leave_type: leaveTypeSchema,
  start_date: z.string(),
  end_date: z.string(),
  days: z.number(),
  unit: leaveUnitSchema,
  hours: z.number().nullable(),
  status: z.enum([
    "draft",
    "pending",
    "approved",
    "rejected",
    "returned",
    "cancelled",
    "awaiting_execution",
  ]),
  created_at: z.string(),
})

/** 本人の休暇申請一覧のレスポンス。 */
export const zAppLeaveRequestSummaryList = z.object({
  data: z.array(zAppLeaveRequestSummary),
  total: z.number(),
})

/** 全社休暇申請一覧（GET /leave-requests/admin）の 1 件。 */
export const zAppLeaveRequestAdminItem = z.object({
  id: z.number(),
  applicant_id: zEmployeeId,
  applicant_name: z.string(),
  applicant_dept_name: z.string().nullable(),
  leave_type: leaveTypeSchema,
  start_date: z.string(),
  end_date: z.string(),
  days: z.number(),
  unit: leaveUnitSchema,
  hours: z.number().nullable(),
  reason: z.string().nullable(),
  status: z.enum(["pending", "approved", "rejected"]),
  created_at: z.string(),
})

/** 全社休暇申請一覧（GET /leave-requests/admin）のレスポンス。 */
export const zAppLeaveRequestAdminList = z.object({
  data: z.array(zAppLeaveRequestAdminItem),
  total: z.number(),
})

/** 本人の休暇残数 1 件（GET /balance/me）。 */
export const zAppLeaveBalance = z.object({
  fiscal_year: z.string(),
  leave_type: leaveTypeSchema,
  granted_days: z.number(),
  used_days: z.number(),
  remaining_days: z.number(),
})

/** 本人の休暇残数一覧（GET /balance/me）。配列を直接返す（data/total ラップなし）。 */
export const zAppLeaveBalanceList = z.array(zAppLeaveBalance)

/** 確認した休暇内容とSystem判断案件の参照結果。 */
export const zLeaveProcedureView = z.object({
  id: z.number().int().positive(),
  applicant_id: zEmployeeId,
  applicant_name: z.string(),
  applicant_dept_name: z.string().nullable(),
  approver_id: zEmployeeId.nullable(),
  approver_name: z.string(),
  leave_type: leaveTypeSchema,
  start_date: z.string(),
  end_date: z.string(),
  days: z.number(),
  unit: leaveUnitSchema,
  hours: z.number().nullable(),
  consumed_days: z.number(),
  reason: z.string().nullable(),
  status: z.enum([
    "pending",
    "approved",
    "rejected",
    "returned",
    "cancelled",
    "awaiting_execution",
  ]),
  workflow_status: z
    .enum(["pending", "approved", "rejected", "returned", "cancelled", "executed"])
    .nullable(),
  created_at: z.string(),
  decision_comment: z.string().nullable(),
  procedure_required: z.boolean(),
  application_id: z.number().nullable(),
  confirmed_content_digest: z.string().regex(/^[a-f0-9]{64}$/),
  can_submit: z.boolean(),
  can_decide: z.boolean(),
  can_execute: z.boolean(),
  can_cancel: z.boolean(),
  can_resubmit: z.boolean(),
  next_leave_request_id: z.number().nullable(),
  previous_leave_request_id: z.number().nullable(),
  decision_target: leaveProcedureDecisionTargetSchema.nullable(),
  required_approvals: z.number().nullable(),
  approvals: z.number(),
  decisions: z.array(
    z.object({
      actor_account_id: z.string(),
      actor_name: z.string().nullable(),
      represented_account_id: z.string(),
      represented_name: z.string().nullable(),
      task_key: z.string(),
      task_round: z.number(),
      action: z.enum(["approve", "reject", "return"]),
      comment: z.string().nullable(),
      decided_at: z.string(),
    }),
  ),
})
