import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { recordSourceFreezeSnapshotSchema } from "@system/domain/schemas/records/record-source-freeze.schema"
import { z } from "zod"

/** 証明書発行依頼 1 件のレスポンス。 */
export const zAppCertificateRequest = z.object({
  id: z.string(),
  requester_id: zEmployeeId,
  certificate_type: z.string(),
  submit_to: z.string().nullable(),
  needed_by: z.string().nullable(),
  note: z.string().nullable(),
  status: z.string(),
  created_at: z.string(),
})

export type AppCertificateRequest = z.infer<typeof zAppCertificateRequest>

/** 証明書発行依頼一覧のレスポンス。 */
export const zAppCertificateRequestList = z.object({
  data: z.array(zAppCertificateRequest),
  total: z.number(),
})

export const certificateRequestSourceFreezeResponseSchema = z.strictObject({
  freeze: recordSourceFreezeSnapshotSchema,
})

export const zAppCertificateRequestCoveragePageReceipt = z.strictObject({
  id: z.uuid(),
  freezeId: z.uuid(),
  sequence: z.number().int().positive().safe(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  afterCursor: z.string().nullable(),
  nextCursor: z.string().nullable(),
  checkedAt: z.string().datetime(),
  recordCount: z.number().int().min(0).max(10),
})

export const zAppCertificateRequestRetirementPlan = z.strictObject({
  id: z.uuid(),
  freezeId: z.uuid(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  totalPages: z.number().int().positive().safe(),
  recordKinds: z.array(z.literal("certificate-request-record")),
  createdAt: z.iso.datetime(),
})

export const zAppCertificateRequestRetirementVerificationReceipt = z.strictObject({
  id: z.uuid(),
  planId: z.uuid(),
  planDigest: z.string().regex(/^[0-9a-f]{64}$/),
  ordinal: z.number().int().positive().safe(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  coveragePageId: z.uuid(),
  checkedAt: z.iso.datetime(),
})

export const zAppCertificateRequestRetirementRequest = z.strictObject({
  number: z.number().int().positive().safe(),
  caseId: z.string().min(1),
  planId: z.uuid(),
  proposalDigest: z.string().regex(/^[0-9a-f]{64}$/),
  status: z.string().min(1),
})

export const zAppCertificateRequestRetirementExecution = z.strictObject({
  retirement_id: z.uuid(),
  finalized_at: z.iso.datetime(),
})
