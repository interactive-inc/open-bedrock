import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { z } from "zod"
import { recordSourceFreezeSnapshotSchema } from "@system/domain/schemas/records/record-source-freeze.schema"

/** ライセンス・SaaS 台帳 1 件のレスポンス。 */
export const licenseResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
  plan_name: z.string().nullable(),
  revision: z.number().int().nonnegative(),
  vendor: z.string().nullable(),
  category: z.string().nullable(),
  seats: z.number().nullable(),
  renewal_deadline: z.string().nullable(),
  owner_employee_id: zEmployeeId.nullable(),
  note: z.string().nullable(),
  status: z.enum(["active", "cancelled"]),
  created_at: z.string(),
})

/** ライセンス・SaaS 台帳一覧のレスポンス。 */
export const licenseListResponseSchema = z.object({
  data: z.array(licenseResponseSchema),
  total: z.number(),
})

/** サービス利用台帳の書込み停止世代。撤去可否の確定とは分離する。 */
export const softwareLicenseSourceFreezeResponseSchema = z.strictObject({
  freeze: recordSourceFreezeSnapshotSchema,
})

/** 照合ページの受領情報。本文、SQL検査、撤去許可は含めない。 */
export const zAppSoftwareLicenseCoveragePageReceipt = z.strictObject({
  id: z.uuid(),
  freezeId: z.uuid(),
  sequence: z.number().int().positive().safe(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  afterCursor: z.string().nullable(),
  nextCursor: z.string().nullable(),
  checkedAt: z.string().datetime(),
  recordCount: z.number().int().min(0).max(10),
})

/** 照合終端を固定した計画。原文の再検証や撤去の承認・実行は別操作とする。 */
export const zAppSoftwareLicenseRetirementPlan = z.strictObject({
  id: z.uuid(),
  freezeId: z.uuid(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  totalPages: z.number().int().positive().safe(),
  recordKinds: z.array(z.literal("license-record")),
  createdAt: z.iso.datetime(),
})

/** 固定した計画のページを再検証した結果。撤去許可は含めない。 */
export const zAppSoftwareLicenseRetirementVerificationReceipt = z.strictObject({
  id: z.uuid(),
  planId: z.uuid(),
  planDigest: z.string().regex(/^[0-9a-f]{64}$/),
  ordinal: z.number().int().positive().safe(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  coveragePageId: z.uuid(),
  checkedAt: z.iso.datetime(),
})

/** 人の判断待ちとして保存した撤去申請。 */
export const zAppSoftwareLicenseRetirementRequest = z.strictObject({
  number: z.number().int().positive().safe(),
  caseId: z.string().min(1),
  planId: z.uuid(),
  proposalDigest: z.string().regex(/^[0-9a-f]{64}$/),
  status: z.string().min(1),
})

/** 原記録を残したまま停止世代を撤去確定した結果。 */
export const zAppSoftwareLicenseRetirementExecution = z.strictObject({
  retirement_id: z.uuid(),
  finalized_at: z.iso.datetime(),
})
