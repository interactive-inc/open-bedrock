import { z } from "zod"
import { recordSourceFreezeSnapshotSchema } from "@system/domain/schemas/records/record-source-freeze.schema"
import { regulationRecordKindSchema } from "@/contexts/regulation/domain/definitions/regulation-record-kind.definition"

export const regulationSourceFreezeResponseSchema = z.strictObject({
  freeze: recordSourceFreezeSnapshotSchema,
})

export const zAppRegulationCoveragePageReceipt = z.strictObject({
  id: z.uuid(),
  freezeId: z.uuid(),
  sequence: z.number().int().positive().safe(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  afterCursor: z.string().nullable(),
  nextCursor: z.string().nullable(),
  checkedAt: z.string().datetime(),
  recordCount: z.number().int().min(0).max(10),
})
export const zAppRegulationRetirementPlan = z.strictObject({
  id: z.uuid(),
  freezeId: z.uuid(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  totalPages: z.number().int().positive().safe(),
  recordKinds: z.array(regulationRecordKindSchema).length(2),
  createdAt: z.iso.datetime(),
})
export const zAppRegulationRetirementVerificationReceipt = z.strictObject({
  id: z.uuid(),
  planId: z.uuid(),
  planDigest: z.string().regex(/^[0-9a-f]{64}$/),
  ordinal: z.number().int().positive().safe(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  coveragePageId: z.uuid(),
  checkedAt: z.iso.datetime(),
})
export const zAppRegulationRetirementRequest = z.strictObject({
  number: z.number().int().positive().safe(),
  caseId: z.string().min(1),
  planId: z.uuid(),
  proposalDigest: z.string().regex(/^[0-9a-f]{64}$/),
  status: z.string().min(1),
})
export const zAppRegulationRetirementExecution = z.strictObject({
  retirement_id: z.uuid(),
  finalized_at: z.iso.datetime(),
})

/** 規程集一覧の 1 件（最新版のメタ情報を含む）。 */
export const zAppRegulationListItem = z.object({
  id: z.number(),
  code: z.string(),
  title: z.string(),
  category: z.string().nullable(),
  status: z.string(),
  latest_version: z.number().nullable(),
  effective_on: z.string().nullable(),
  created_at: z.string(),
})

/** 規程集一覧のレスポンス。 */
export const zAppRegulationList = z.object({
  data: z.array(zAppRegulationListItem),
  total: z.number(),
})

/** 規程の改定版 1 件。 */
export const zAppRegulationVersion = z.object({
  id: z.number(),
  version: z.number(),
  body_md: z.string(),
  effective_on: z.string(),
  note: z.string().nullable(),
  created_at: z.string(),
})

/** 規程 1 件の詳細（最新版＋版一覧）。 */
export const zAppRegulationDetail = z.object({
  id: z.number(),
  code: z.string(),
  title: z.string(),
  category: z.string().nullable(),
  status: z.string(),
  created_at: z.string(),
  latest_version: zAppRegulationVersion.nullable(),
  versions: z.array(zAppRegulationVersion),
})

/** 規程の新規登録・新版追加・アーカイブのレスポンス（規程本体のメタ）。 */
export const zAppRegulation = z.object({
  id: z.number(),
  code: z.string(),
  title: z.string(),
  category: z.string().nullable(),
  status: z.string(),
  created_at: z.string(),
})
