import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { trainingRecordKindSchema } from "@/contexts/training/domain/definitions/training-record-kind.definition"
import { recordSourceFreezeSnapshotSchema } from "@system/domain/schemas/records/record-source-freeze.schema"
import { z } from "zod"

/** 研修コース 1 件のレスポンス。 */
export const zAppTrainingCourse = z.object({
  id: z.uuid(),
  code: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  duration_minutes: z.number().nullable(),
  category: z.string(),
  is_required: z.boolean(),
  status: z.string(),
})

/** 研修コース一覧のレスポンス。 */
export const zAppTrainingCourseList = z.object({
  data: z.array(zAppTrainingCourse),
  total: z.number(),
})

/** 受講登録 1 件のレスポンス。 */
export const zAppTrainingEnrollment = z.object({
  id: z.uuid(),
  course_id: z.uuid(),
  employee_id: zEmployeeId,
  status: z.string(),
  completed_at: z.string().nullable(),
  score: z.number().nullable(),
  due_date: z.string().nullable(),
})

/** 受講登録一覧のレスポンス。 */
export const zAppTrainingEnrollmentList = z.object({
  data: z.array(zAppTrainingEnrollment),
  total: z.number(),
})

export const trainingSourceFreezeResponseSchema = z.strictObject({
  freeze: recordSourceFreezeSnapshotSchema,
})
export const zAppTrainingCoveragePageReceipt = z.strictObject({
  id: z.uuid(),
  freezeId: z.uuid(),
  sequence: z.number().int().positive().safe(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  afterCursor: z.string().nullable(),
  nextCursor: z.string().nullable(),
  checkedAt: z.string().datetime(),
  recordCount: z.number().int().min(0).max(10),
})
export const zAppTrainingRetirementPlan = z.strictObject({
  id: z.uuid(),
  freezeId: z.uuid(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  totalPages: z.number().int().positive().safe(),
  recordKinds: z.array(trainingRecordKindSchema).length(2),
  createdAt: z.iso.datetime(),
})
export const zAppTrainingRetirementVerificationReceipt = z.strictObject({
  id: z.uuid(),
  planId: z.uuid(),
  planDigest: z.string().regex(/^[0-9a-f]{64}$/),
  ordinal: z.number().int().positive().safe(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  coveragePageId: z.uuid(),
  checkedAt: z.iso.datetime(),
})
export const zAppTrainingRetirementRequest = z.strictObject({
  number: z.number().int().positive().safe(),
  caseId: z.string().min(1),
  planId: z.uuid(),
  proposalDigest: z.string().regex(/^[0-9a-f]{64}$/),
  status: z.string().min(1),
})
export const zAppTrainingRetirementExecution = z.strictObject({
  retirement_id: z.uuid(),
  finalized_at: z.iso.datetime(),
})
