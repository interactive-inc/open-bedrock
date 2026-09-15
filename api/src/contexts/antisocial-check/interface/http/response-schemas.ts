import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { recordSourceFreezeSnapshotSchema } from "@system/domain/schemas/records/record-source-freeze.schema"
import { z } from "zod"

/**
 * ===========================================================================
 * 以下、各ドメインのレスポンススキーマ
 * ===========================================================================
 * ===== antisocial-check =====
 */
export const zAppAntisocialCheck = z.object({
  id: z.string(),
  requester_id: zEmployeeId,
  partner_name: z.string(),
  partner_address: z.string().nullable(),
  representative_name: z.string().nullable(),
  result: z.string().nullable(),
  status: z.string(),
  created_at: z.string(),
})

export const zAppAntisocialCheckList = z.object({
  data: z.array(zAppAntisocialCheck),
  total: z.number(),
})

/** 管理受信箱の反社チェック申請。申請者名を含む。 */
export const zAppAntisocialCheckAdminItem = zAppAntisocialCheck.extend({
  requester_name: z.string(),
})

export const zAppAntisocialCheckAdminList = z.object({
  data: z.array(zAppAntisocialCheckAdminItem),
  total: z.number(),
})

export const antisocialCheckSourceFreezeResponseSchema = z.strictObject({ freeze: recordSourceFreezeSnapshotSchema })

export const zAppAntisocialCheckCoveragePageReceipt = z.strictObject({
  id: z.uuid(), freezeId: z.uuid(), sequence: z.number().int().positive().safe(),
  digest: z.string().regex(/^[0-9a-f]{64}$/), afterCursor: z.string().nullable(),
  nextCursor: z.string().nullable(), checkedAt: z.string().datetime(),
  recordCount: z.number().int().min(0).max(10),
})

export const zAppAntisocialCheckRetirementPlan = z.strictObject({
  id: z.uuid(), freezeId: z.uuid(), digest: z.string().regex(/^[0-9a-f]{64}$/),
  totalPages: z.number().int().positive().safe(), recordKinds: z.array(z.literal("antisocial-check-record")),
  createdAt: z.iso.datetime(),
})

export const zAppAntisocialCheckRetirementVerificationReceipt = z.strictObject({
  id: z.uuid(), planId: z.uuid(), planDigest: z.string().regex(/^[0-9a-f]{64}$/),
  ordinal: z.number().int().positive().safe(), digest: z.string().regex(/^[0-9a-f]{64}$/),
  coveragePageId: z.uuid(), checkedAt: z.iso.datetime(),
})

export const zAppAntisocialCheckRetirementRequest = z.strictObject({
  number: z.number().int().positive().safe(), caseId: z.string().min(1), planId: z.uuid(),
  proposalDigest: z.string().regex(/^[0-9a-f]{64}$/), status: z.string().min(1),
})

export const zAppAntisocialCheckRetirementExecution = z.strictObject({
  retirement_id: z.uuid(), finalized_at: z.iso.datetime(),
})
