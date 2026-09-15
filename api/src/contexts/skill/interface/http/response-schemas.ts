import { z } from "zod"
import { skillRecordKindSchema } from "@/contexts/skill/domain/skill-record-kind"
import { recordSourceFreezeSnapshotSchema } from "@system/domain/schemas/records/record-source-freeze.schema"

/** スキルマスタ 1 件のレスポンス。 */
export const zAppSkill = z.object({
  code: z.string(),
  name: z.string(),
  category: z.string(),
})

/** スキルマスタ一覧のレスポンス。 */
export const zAppSkillList = z.object({
  data: z.array(zAppSkill),
  total: z.number(),
})

/** 本人の登録スキル 1 件のレスポンス（スキルマスタ結合済み）。 */
export const zAppEmployeeSkill = z.object({
  skill_code: z.string(),
  skill_name: z.string(),
  skill_category: z.string(),
  level: z.number(),
  years: z.number().nullable(),
  note: z.string().nullable(),
})

/** 本人の登録スキル一覧のレスポンス。 */
export const zAppEmployeeSkillList = z.object({
  data: z.array(zAppEmployeeSkill),
  total: z.number(),
})

export const skillSourceFreezeResponseSchema = z.strictObject({
  freeze: recordSourceFreezeSnapshotSchema,
})
export const zAppSkillCoveragePageReceipt = z.strictObject({
  id: z.uuid(), freezeId: z.uuid(), sequence: z.number().int().positive().safe(),
  digest: z.string().regex(/^[0-9a-f]{64}$/), afterCursor: z.string().nullable(),
  nextCursor: z.string().nullable(), checkedAt: z.string().datetime(),
  recordCount: z.number().int().min(0).max(10),
})
export const zAppSkillRetirementPlan = z.strictObject({
  id: z.uuid(), freezeId: z.uuid(), digest: z.string().regex(/^[0-9a-f]{64}$/),
  totalPages: z.number().int().positive().safe(),
  recordKinds: z.array(skillRecordKindSchema).length(2),
  createdAt: z.iso.datetime(),
})
export const zAppSkillRetirementVerificationReceipt = z.strictObject({
  id: z.uuid(), planId: z.uuid(), planDigest: z.string().regex(/^[0-9a-f]{64}$/),
  ordinal: z.number().int().positive().safe(), digest: z.string().regex(/^[0-9a-f]{64}$/),
  coveragePageId: z.uuid(), checkedAt: z.iso.datetime(),
})
export const zAppSkillRetirementRequest = z.strictObject({
  number: z.number().int().positive().safe(), caseId: z.string().min(1), planId: z.uuid(),
  proposalDigest: z.string().regex(/^[0-9a-f]{64}$/), status: z.string().min(1),
})
export const zAppSkillRetirementExecution = z.strictObject({
  retirement_id: z.uuid(), finalized_at: z.iso.datetime(),
})
