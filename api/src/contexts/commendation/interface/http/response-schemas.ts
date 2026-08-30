import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { z } from "zod"

/** 表彰の記録 1 件のレスポンス（社内公開）。 */
export const zAppCommendation = z.object({
  id: z.number(),
  employee_id: zEmployeeId,
  title: z.string(),
  reason: z.string(),
  awarded_on: z.string(),
  created_at: z.string(),
})

/** 表彰の記録一覧のレスポンス。 */
export const zAppCommendationList = z.object({
  data: z.array(zAppCommendation),
  total: z.number(),
})
