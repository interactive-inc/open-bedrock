import { z } from "zod"
import { partnerRecordKindSchema } from "@/contexts/partner/domain/definitions/partner-record-kind.definition"
import { recordSourceFreezeSnapshotSchema } from "@system/domain/schemas/records/record-source-freeze.schema"

export const partnerSourceFreezeResponseSchema = z.strictObject({
  freeze: recordSourceFreezeSnapshotSchema,
})

export const zAppPartnerCoveragePageReceipt = z.strictObject({
  id: z.uuid(),
  freezeId: z.uuid(),
  sequence: z.number().int().positive().safe(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  afterCursor: z.string().nullable(),
  nextCursor: z.string().nullable(),
  checkedAt: z.string().datetime(),
  recordCount: z.number().int().min(0).max(10),
})
export const zAppPartnerRetirementPlan = z.strictObject({
  id: z.uuid(),
  freezeId: z.uuid(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  totalPages: z.number().int().positive().safe(),
  recordKinds: z.array(partnerRecordKindSchema).length(2),
  createdAt: z.iso.datetime(),
})
export const zAppPartnerRetirementVerificationReceipt = z.strictObject({
  id: z.uuid(),
  planId: z.uuid(),
  planDigest: z.string().regex(/^[0-9a-f]{64}$/),
  ordinal: z.number().int().positive().safe(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  coveragePageId: z.uuid(),
  checkedAt: z.iso.datetime(),
})
export const zAppPartnerRetirementRequest = z.strictObject({
  number: z.number().int().positive().safe(),
  caseId: z.string().min(1),
  planId: z.uuid(),
  proposalDigest: z.string().regex(/^[0-9a-f]{64}$/),
  status: z.string().min(1),
})
export const zAppPartnerRetirementExecution = z.strictObject({
  retirement_id: z.uuid(),
  finalized_at: z.iso.datetime(),
})

/** 取引先 1 件のレスポンス。 */
export const zAppPartner = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  category: z.string().nullable(),
  corporate_number: z.string().nullable(),
  note: z.string().nullable(),
  status: z.string(),
  created_at: z.string(),
})

/** 取引先一覧のレスポンス。 */
export const zAppPartnerList = z.object({
  data: z.array(zAppPartner),
  total: z.number(),
})

/** 契約記録 1 件のレスポンス。 */
export const zAppContract = z.object({
  id: z.number(),
  partner_id: z.number(),
  title: z.string(),
  contract_date: z.string(),
  starts_on: z.string().nullable(),
  ends_on: z.string().nullable(),
  renewal_deadline: z.string().nullable(),
  note: z.string().nullable(),
  created_at: z.string(),
})

/** 契約記録一覧のレスポンス。 */
export const zAppContractList = z.object({
  data: z.array(zAppContract),
  total: z.number(),
})
