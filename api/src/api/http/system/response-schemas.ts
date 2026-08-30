import { z } from "zod"

/** 外部 identity 同期（プロビジョニング）の件数サマリ。 */
export const zAppProvisioningSummary = z.object({
  created: z.number(),
  updated: z.number(),
  skipped: z.number(),
})

/** 権限カタログ 1 件のレスポンス。 */
export const zAppPermission = z.object({
  key: z.string(),
  description: z.string(),
  category: z.string(),
})

/** 権限カタログ一覧のレスポンス。 */
export const zAppPermissionList = z.object({
  data: z.array(zAppPermission),
  total: z.number(),
})
