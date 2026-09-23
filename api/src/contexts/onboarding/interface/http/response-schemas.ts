import { z } from "zod"
import {
  onboardingRecordKindSchema,
  onboardingRecordKinds,
} from "@/contexts/onboarding/domain/definitions/onboarding-record-kind.definition"
import { recordSourceFreezeSnapshotSchema } from "@system/domain/schemas/records/record-source-freeze.schema"

export const onboardingSourceFreezeResponseSchema = z.strictObject({
  freeze: recordSourceFreezeSnapshotSchema,
})

export const zAppOnboardingCoveragePageReceipt = z.strictObject({
  id: z.uuid(),
  freezeId: z.uuid(),
  sequence: z.number().int().positive().safe(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  afterCursor: z.string().nullable(),
  nextCursor: z.string().nullable(),
  checkedAt: z.string().datetime(),
  recordCount: z.number().int().min(0).max(10),
})
export const zAppOnboardingRetirementPlan = z.strictObject({
  id: z.uuid(),
  freezeId: z.uuid(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  totalPages: z.number().int().positive().safe(),
  recordKinds: z.array(onboardingRecordKindSchema).length(onboardingRecordKinds.length),
  createdAt: z.iso.datetime(),
})
export const zAppOnboardingRetirementVerificationReceipt = z.strictObject({
  id: z.uuid(),
  planId: z.uuid(),
  planDigest: z.string().regex(/^[0-9a-f]{64}$/),
  ordinal: z.number().int().positive().safe(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  coveragePageId: z.uuid(),
  checkedAt: z.iso.datetime(),
})
export const zAppOnboardingRetirementRequest = z.strictObject({
  number: z.number().int().positive().safe(),
  caseId: z.string().min(1),
  planId: z.uuid(),
  proposalDigest: z.string().regex(/^[0-9a-f]{64}$/),
  status: z.string().min(1),
})
export const zAppOnboardingRetirementExecution = z.strictObject({
  retirement_id: z.uuid(),
  finalized_at: z.iso.datetime(),
})

/** オンボーディングテンプレート 1 件のレスポンス。 */
export const zAppOnboardingTemplate = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  kind: z.string(),
  description: z.string().nullable(),
})

/** オンボーディングテンプレート一覧の要素。task_count を持ち id は持たない。 */
export const zAppOnboardingTemplateListItem = z.object({
  code: z.string(),
  name: z.string(),
  kind: z.string(),
  description: z.string().nullable(),
  task_count: z.number(),
  lifecycle_effect: z.enum(["hire", "retired"]).nullable(),
})

/** オンボーディングテンプレート一覧のレスポンス。 */
export const zAppOnboardingTemplateList = z.object({
  data: z.array(zAppOnboardingTemplateListItem),
  total: z.number(),
})

/** オンボーディングタスク 1 件のレスポンス。 */
export const zAppOnboardingTask = z.object({
  id: z.number(),
  template_task_code: z.string(),
  title: z.string(),
  order: z.number(),
  status: z.string(),
  completed_at: z.string().nullable(),
})

/** オンボーディングタスク一覧のレスポンス。 */
export const zAppOnboardingTaskList = z.object({
  data: z.array(zAppOnboardingTask),
  total: z.number(),
})

/** オンボーディング割り当て 1 件のレスポンス。template_name は割当一覧/作成時のみ含む。 */
export const zAppOnboardingAssignment = z.object({
  id: z.number(),
  employee_code: z.string(),
  employee_name: z.string(),
  template_code: z.string(),
  template_name: z.string().optional(),
  kind: z.string(),
  status: z.string(),
  assigned_at: z.string(),
  tasks: z.array(zAppOnboardingTask),
})

/** オンボーディング割り当て一覧のレスポンス。 */
export const zAppOnboardingAssignmentList = z.object({
  data: z.array(zAppOnboardingAssignment),
  total: z.number(),
})

/** 入退社の配送状態と受領結果。時刻はUnixミリ秒。 */
export const zAppOnboardingLifecycleDeliveryList = z.object({
  data: z.array(
    z.object({
      job_id: z.string(),
      action_id: z.string(),
      outcome: z.enum(["assigned", "superseded", "obsolete"]).nullable(),
      assignment_id: z.number().int().nullable(),
      processed_at: z.number().int().nullable(),
      status: z.enum(["queued", "leased", "succeeded", "dead_letter"]),
      attempt: z.number().int(),
      max_attempts: z.number().int(),
      available_at: z.number().int(),
      last_error_code: z.string().nullable(),
      dead_letter_id: z.string().nullable(),
      requeued_job_id: z.string().nullable(),
    }),
  ),
})
