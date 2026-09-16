import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { z } from "zod"
import { ringiRecordKindSchema } from "@/contexts/ringi/domain/definitions/ringi-record-kind.definition"
import { recordSourceFreezeSnapshotSchema } from "@system/domain/schemas/records/record-source-freeze.schema"

export const ringiSourceFreezeResponseSchema = z.strictObject({
  freeze: recordSourceFreezeSnapshotSchema,
})

export const zAppRingiCoveragePageReceipt = z.strictObject({
  id: z.uuid(),
  freezeId: z.uuid(),
  sequence: z.number().int().positive().safe(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  afterCursor: z.string().nullable(),
  nextCursor: z.string().nullable(),
  checkedAt: z.string().datetime(),
  recordCount: z.number().int().min(0).max(10),
})
export const zAppRingiRetirementPlan = z.strictObject({
  id: z.uuid(),
  freezeId: z.uuid(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  totalPages: z.number().int().positive().safe(),
  recordKinds: z.array(ringiRecordKindSchema).length(2),
  createdAt: z.iso.datetime(),
})
export const zAppRingiRetirementVerificationReceipt = z.strictObject({
  id: z.uuid(),
  planId: z.uuid(),
  planDigest: z.string().regex(/^[0-9a-f]{64}$/),
  ordinal: z.number().int().positive().safe(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  coveragePageId: z.uuid(),
  checkedAt: z.iso.datetime(),
})
export const zAppRingiRetirementRequest = z.strictObject({
  number: z.number().int().positive().safe(),
  caseId: z.string().min(1),
  planId: z.uuid(),
  proposalDigest: z.string().regex(/^[0-9a-f]{64}$/),
  status: z.string().min(1),
})
export const zAppRingiRetirementExecution = z.strictObject({
  retirement_id: z.uuid(),
  finalized_at: z.iso.datetime(),
})

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

/** 同じ案件から取得する稟議の内容・操作資格・判断対象。 */
export const zRingiProcedureView = zAppRingi.extend({
  status: z.enum([
    "pending",
    "approved",
    "rejected",
    "returned",
    "cancelled",
    "awaiting_execution",
  ]),
  applicant_name: z.string(),
  applicant_dept_name: z.string().nullable(),
  approver_name: z.string(),
  procedure_required: z.boolean(),
  application_id: z.number().int().positive().nullable(),
  previous_ringi_id: z.number().int().positive().nullable(),
  decision_target: z
    .object({
      proposal_version: z.number().int().positive(),
      proposal_digest: z.string().regex(/^[a-f0-9]{64}$/),
      task_key: z.string().min(1),
      task_round: z.number().int().positive(),
    })
    .nullable(),
  next_ringi_id: z.number().int().positive().nullable(),
  can_submit_legacy: z.boolean(),
  can_decide: z.boolean(),
  can_execute: z.boolean(),
  can_cancel: z.boolean(),
  can_resubmit: z.boolean(),
  required_approvals: z.number().int().positive().nullable(),
  approvals: z.number().int().nonnegative(),
  decisions: z.array(
    z.object({
      task_key: z.string(),
      task_round: z.number().int().positive(),
      action: z.enum(["approve", "reject", "return"]),
      comment: z.string().nullable(),
      decided_at: z.string(),
    }),
  ),
})
