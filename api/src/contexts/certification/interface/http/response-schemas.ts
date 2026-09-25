import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { certificationRecordKindSchema } from "@/contexts/certification/domain/definitions/certification-record-kind.definition"
import { recordSourceFreezeSnapshotSchema } from "@system/domain/schemas/records/record-source-freeze.schema"
import { z } from "zod"

/** 資格マスタ 1 件のレスポンス。 */
export const zAppCertification = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  issuer: z.string().nullable(),
  description: z.string().nullable(),
  created_at: z.string(),
})

/** 資格マスタ一覧のレスポンス。 */
export const zAppCertificationList = z.object({
  data: z.array(zAppCertification),
  total: z.number(),
})

/** 従業員の資格保有記録 1 件のレスポンス。 */
export const zAppEmployeeCertification = z.object({
  id: z.uuid(),
  employee_id: zEmployeeId,
  certification_id: z.uuid(),
  acquired_on: z.string(),
  expires_on: z.string().nullable(),
  note: z.string().nullable(),
  created_at: z.string(),
})

/** 資格保有記録一覧のレスポンス。 */
export const zAppEmployeeCertificationList = z.object({
  data: z.array(zAppEmployeeCertification),
  total: z.number(),
})

export const certificationSourceFreezeResponseSchema = z.strictObject({
  freeze: recordSourceFreezeSnapshotSchema,
})
export const zAppCertificationCoveragePageReceipt = z.strictObject({
  id: z.uuid(),
  freezeId: z.uuid(),
  sequence: z.number().int().positive().safe(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  afterCursor: z.string().nullable(),
  nextCursor: z.string().nullable(),
  checkedAt: z.string().datetime(),
  recordCount: z.number().int().min(0).max(10),
})
export const zAppCertificationRetirementPlan = z.strictObject({
  id: z.uuid(),
  freezeId: z.uuid(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  totalPages: z.number().int().positive().safe(),
  recordKinds: z.array(certificationRecordKindSchema).length(2),
  createdAt: z.iso.datetime(),
})
export const zAppCertificationRetirementVerificationReceipt = z.strictObject({
  id: z.uuid(),
  planId: z.uuid(),
  planDigest: z.string().regex(/^[0-9a-f]{64}$/),
  ordinal: z.number().int().positive().safe(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  coveragePageId: z.uuid(),
  checkedAt: z.iso.datetime(),
})
export const zAppCertificationRetirementRequest = z.strictObject({
  number: z.number().int().positive().safe(),
  caseId: z.string().min(1),
  planId: z.uuid(),
  proposalDigest: z.string().regex(/^[0-9a-f]{64}$/),
  status: z.string().min(1),
})
export const zAppCertificationRetirementExecution = z.strictObject({
  retirement_id: z.uuid(),
  finalized_at: z.iso.datetime(),
})
