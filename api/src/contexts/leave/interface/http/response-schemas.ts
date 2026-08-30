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
  status: z.enum(["pending", "approved", "rejected"]),
  created_at: z.string(),
})

/** 本人の休暇申請一覧のレスポンス。 */
export const zAppLeaveRequestSummaryList = z.object({
  data: z.array(zAppLeaveRequestSummary),
  total: z.number(),
})

/** 承認待ち休暇申請一覧 1 件（GET /requests/inbox）。applicant_name を含む。 */
export const zAppLeaveRequestInbox = z.object({
  id: z.number(),
  applicant_name: z.string(),
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

/** 承認待ち休暇申請一覧のレスポンス。 */
export const zAppLeaveRequestInboxList = z.object({
  data: z.array(zAppLeaveRequestInbox),
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
