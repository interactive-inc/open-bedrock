import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { z } from "zod"

/** ===== ringi ===== */
const ringiStatus = z.enum(["pending", "approved", "rejected"])

/** 稟議 1 件のレスポンス。 */
export const zAppRingi = z.object({
  id: z.number(),
  applicant_id: zEmployeeId,
  approver_id: zEmployeeId,
  title: z.string(),
  amount: z.number(),
  reason: z.string(),
  status: ringiStatus,
  decided_at: z.string().nullable(),
  decision_comment: z.string().nullable(),
  created_at: z.string(),
})

/** 本人が起案した稟議一覧の 1 件。 */
export const zAppRingiMineItem = z.object({
  id: z.number(),
  approver_id: zEmployeeId,
  approver_name: z.string(),
  title: z.string(),
  amount: z.number(),
  status: ringiStatus,
  decided_at: z.string().nullable(),
  created_at: z.string(),
})

/** 本人が起案した稟議一覧のレスポンス。 */
export const zAppRingiMineList = z.object({
  data: z.array(zAppRingiMineItem),
  total: z.number(),
})

/** 承認待ち稟議一覧（自分が承認者）の 1 件。 */
export const zAppRingiInboxItem = z.object({
  id: z.number(),
  applicant_id: zEmployeeId,
  applicant_name: z.string(),
  title: z.string(),
  amount: z.number(),
  reason: z.string(),
  status: ringiStatus,
  created_at: z.string(),
})

/** 承認待ち稟議一覧のレスポンス。 */
export const zAppRingiInboxList = z.object({
  data: z.array(zAppRingiInboxItem),
  total: z.number(),
})

/** 稟議の承認・却下結果（status のみ）。 */
export const zAppRingiDecision = z.object({
  status: ringiStatus,
})

/** 全社稟議一覧（GET /ringi-requests/admin）の 1 件。 */
export const zAppRingiAdminItem = z.object({
  id: z.number(),
  applicant_id: zEmployeeId,
  applicant_name: z.string(),
  applicant_dept_name: z.string().nullable(),
  approver_id: zEmployeeId,
  approver_name: z.string(),
  title: z.string(),
  amount: z.number(),
  status: ringiStatus,
  decided_at: z.string().nullable(),
  created_at: z.string(),
})

/** 全社稟議一覧（GET /ringi-requests/admin）のレスポンス。 */
export const zAppRingiAdminList = z.object({
  data: z.array(zAppRingiAdminItem),
  total: z.number(),
})
