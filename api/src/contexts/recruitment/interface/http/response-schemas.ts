import { z } from "zod"
import { recruitmentRecordKindSchema } from "@/contexts/recruitment/domain/definitions/recruitment-record-kind.definition"
import { recordSourceFreezeSnapshotSchema } from "@system/domain/schemas/records/record-source-freeze.schema"

export const recruitmentSourceFreezeResponseSchema = z.strictObject({
  freeze: recordSourceFreezeSnapshotSchema,
})

export const zAppRecruitmentCoveragePageReceipt = z.strictObject({
  id: z.uuid(),
  freezeId: z.uuid(),
  sequence: z.number().int().positive().safe(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  afterCursor: z.string().nullable(),
  nextCursor: z.string().nullable(),
  checkedAt: z.string().datetime(),
  recordCount: z.number().int().min(0).max(10),
})
export const zAppRecruitmentRetirementPlan = z.strictObject({
  id: z.uuid(),
  freezeId: z.uuid(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  totalPages: z.number().int().positive().safe(),
  recordKinds: z.array(recruitmentRecordKindSchema).length(2),
  createdAt: z.iso.datetime(),
})
export const zAppRecruitmentRetirementVerificationReceipt = z.strictObject({
  id: z.uuid(),
  planId: z.uuid(),
  planDigest: z.string().regex(/^[0-9a-f]{64}$/),
  ordinal: z.number().int().positive().safe(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  coveragePageId: z.uuid(),
  checkedAt: z.iso.datetime(),
})
export const zAppRecruitmentRetirementRequest = z.strictObject({
  number: z.number().int().positive().safe(),
  caseId: z.string().min(1),
  planId: z.uuid(),
  proposalDigest: z.string().regex(/^[0-9a-f]{64}$/),
  status: z.string().min(1),
})
export const zAppRecruitmentRetirementExecution = z.strictObject({
  retirement_id: z.uuid(),
  finalized_at: z.iso.datetime(),
})

/** 募集ポジション 1 件のレスポンス。 */
export const zAppRecruitmentPosition = z.object({
  id: z.number(),
  title: z.string(),
  department_code: z.string().nullable(),
  status: z.string(),
  note: z.string().nullable(),
  created_at: z.string(),
})

/** 募集ポジション一覧のレスポンス。 */
export const zAppRecruitmentPositionList = z.object({
  data: z.array(zAppRecruitmentPosition),
  total: z.number(),
})

/** 応募者 1 件のレスポンス（社外個人情報。閲覧も recruitment:manage に閉じる）。 */
export const zAppRecruitmentCandidate = z.object({
  id: z.number(),
  position_id: z.number(),
  name: z.string(),
  email: z.string().nullable(),
  source: z.string().nullable(),
  stage: z.string(),
  note: z.string().nullable(),
  created_at: z.string(),
})

/** 応募者一覧のレスポンス。 */
export const zAppRecruitmentCandidateList = z.object({
  data: z.array(zAppRecruitmentCandidate),
  total: z.number(),
})
