import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { assetRecordKindSchema } from "@/contexts/asset/domain/asset-record-kind"
import { recordSourceFreezeSnapshotSchema } from "@system/domain/schemas/records/record-source-freeze.schema"
import { z } from "zod"

/** 資産 1 件のレスポンス。廃棄済みは disposed_on / disposal_reason を伴う。 */
export const zAppAsset = z.object({
  code: z.string(),
  name: z.string(),
  kind: z.string(),
  serial: z.string().nullable(),
  purchased_on: z.string().nullable(),
  status: z.string(),
  holder_employee_id: zEmployeeId.nullable(),
  disposed_on: z.string().nullable().default(null),
  disposal_reason: z.string().nullable().default(null),
})

/** 保有状況一覧（GET /assets/holdings）の 1 件。誰が何をいつ借りているか。 */
export const zAppAssetHolding = z.object({
  asset_code: z.string(),
  asset_name: z.string(),
  kind: z.string(),
  holder_employee_id: zEmployeeId,
  // 保有者は employees.code の innerJoin。外部プロビジョニングの保有者は code=null になり得るため nullable。
  holder_employee_code: z.string().nullable(),
  holder_employee_name: z.string(),
  lent_at: z.string().nullable(),
})

/** 保有状況一覧のレスポンス。 */
export const zAppAssetHoldingList = z.object({
  data: z.array(zAppAssetHolding),
  total: z.number(),
})

/** 棚卸しセッション 1 件（対象資産の確認状況を含む）。 */
export const zAppStocktakeItem = z.object({
  asset_code: z.string(),
  asset_name: z.string(),
  kind: z.string(),
  checked_at: z.string().nullable(),
  checker_employee_id: zEmployeeId.nullable(),
  location_note: z.string().nullable(),
})

/** 棚卸しセッション 1 件のレスポンス（詳細。items を含む）。 */
export const zAppStocktake = z.object({
  id: z.string(),
  name: z.string(),
  target_date: z.string(),
  status: z.enum(["open", "closed"]),
  created_at: z.string(),
  closed_at: z.string().nullable(),
  checked_count: z.number(),
  total_count: z.number(),
  items: z.array(zAppStocktakeItem).default([]),
})

/** 棚卸しセッション一覧の 1 件（items を含まない）。 */
export const zAppStocktakeListItem = z.object({
  id: z.string(),
  name: z.string(),
  target_date: z.string(),
  status: z.enum(["open", "closed"]),
  created_at: z.string(),
  closed_at: z.string().nullable(),
  checked_count: z.number(),
  total_count: z.number(),
})

/** 棚卸しセッション一覧のレスポンス。 */
export const zAppStocktakeList = z.object({
  data: z.array(zAppStocktakeListItem),
  total: z.number(),
})

/** 資産一覧のレスポンス。 */
export const zAppAssetList = z.object({
  data: z.array(zAppAsset),
  total: z.number(),
})

export const assetSourceFreezeResponseSchema = z.strictObject({ freeze: recordSourceFreezeSnapshotSchema })
export const zAppAssetCoveragePageReceipt = z.strictObject({
  id: z.uuid(), freezeId: z.uuid(), sequence: z.number().int().positive().safe(),
  digest: z.string().regex(/^[0-9a-f]{64}$/), afterCursor: z.string().nullable(),
  nextCursor: z.string().nullable(), checkedAt: z.string().datetime(),
  recordCount: z.number().int().min(0).max(10),
})
export const zAppAssetRetirementPlan = z.strictObject({
  id: z.uuid(), freezeId: z.uuid(), digest: z.string().regex(/^[0-9a-f]{64}$/),
  totalPages: z.number().int().positive().safe(), recordKinds: z.array(assetRecordKindSchema).length(4),
  createdAt: z.iso.datetime(),
})
export const zAppAssetRetirementVerificationReceipt = z.strictObject({
  id: z.uuid(), planId: z.uuid(), planDigest: z.string().regex(/^[0-9a-f]{64}$/),
  ordinal: z.number().int().positive().safe(), digest: z.string().regex(/^[0-9a-f]{64}$/),
  coveragePageId: z.uuid(), checkedAt: z.iso.datetime(),
})
export const zAppAssetRetirementRequest = z.strictObject({
  number: z.number().int().positive().safe(), caseId: z.string().min(1), planId: z.uuid(),
  proposalDigest: z.string().regex(/^[0-9a-f]{64}$/), status: z.string().min(1),
})
export const zAppAssetRetirementExecution = z.strictObject({
  retirement_id: z.uuid(), finalized_at: z.iso.datetime(),
})
