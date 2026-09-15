import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { recordSourceFreezeSnapshotSchema } from "@system/domain/schemas/records/record-source-freeze.schema"
import { z } from "zod"

/** ナレッジ記事一覧の 1 件（本文は snippet に短縮）。 */
export const zAppKnowledgeListItem = z.object({
  id: z.number(),
  revision: z.number().int().positive(),
  status: z.enum(["active", "withdrawn"]),
  category: z.string(),
  title: z.string(),
  snippet: z.string(),
  author_id: zEmployeeId,
  created_at: z.string(),
})

/** ナレッジ記事一覧のレスポンス。 */
export const zAppKnowledgeList = z.object({
  data: z.array(zAppKnowledgeListItem),
  total: z.number(),
})

/** ナレッジ記事 1 件の詳細レスポンス（GET /knowledge-articles/:id）。 */
export const zAppKnowledge = z.object({
  id: z.number(),
  revision: z.number().int().positive(),
  status: z.enum(["active", "withdrawn"]),
  title: z.string(),
  category: z.string(),
  tags: z.string().nullable(),
  body_md: z.string(),
  author_id: zEmployeeId,
  created_at: z.string(),
})

/** ナレッジ記事の作成・更新レスポンス（POST /knowledge-articles, PUT /knowledge-articles/:id）。 */
export const zAppKnowledgeWritten = z.object({
  id: z.number(),
  revision: z.number().int().positive(),
  status: z.enum(["active", "withdrawn"]),
  title: z.string(),
  category: z.string(),
  tags: z.string().nullable(),
  body_md: z.string(),
})

export const knowledgeSourceFreezeResponseSchema = z.strictObject({ freeze: recordSourceFreezeSnapshotSchema })
export const zAppKnowledgeCoveragePageReceipt = z.strictObject({
  id: z.uuid(), freezeId: z.uuid(), sequence: z.number().int().positive().safe(),
  digest: z.string().regex(/^[0-9a-f]{64}$/), afterCursor: z.string().nullable(),
  nextCursor: z.string().nullable(), checkedAt: z.string().datetime(),
  recordCount: z.number().int().min(0).max(10),
})
export const zAppKnowledgeRetirementPlan = z.strictObject({
  id: z.uuid(), freezeId: z.uuid(), digest: z.string().regex(/^[0-9a-f]{64}$/),
  totalPages: z.number().int().positive().safe(), recordKinds: z.array(z.literal("knowledge-article-record")),
  createdAt: z.iso.datetime(),
})
export const zAppKnowledgeRetirementVerificationReceipt = z.strictObject({
  id: z.uuid(), planId: z.uuid(), planDigest: z.string().regex(/^[0-9a-f]{64}$/),
  ordinal: z.number().int().positive().safe(), digest: z.string().regex(/^[0-9a-f]{64}$/),
  coveragePageId: z.uuid(), checkedAt: z.iso.datetime(),
})
export const zAppKnowledgeRetirementRequest = z.strictObject({
  number: z.number().int().positive().safe(), caseId: z.string().min(1), planId: z.uuid(),
  proposalDigest: z.string().regex(/^[0-9a-f]{64}$/), status: z.string().min(1),
})
export const zAppKnowledgeRetirementExecution = z.strictObject({
  retirement_id: z.uuid(), finalized_at: z.iso.datetime(),
})
