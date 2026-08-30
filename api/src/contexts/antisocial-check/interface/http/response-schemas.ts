import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
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
