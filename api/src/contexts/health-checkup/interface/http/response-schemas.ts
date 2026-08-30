import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { z } from "zod"

/** 健診・ストレスチェック実施記録 1 件のレスポンス。結果は持たない。 */
export const zAppHealthCheckup = z.object({
  id: z.number(),
  employee_id: zEmployeeId,
  fiscal_year: z.number(),
  checkup_kind: z.string(),
  conducted_on: z.string().nullable(),
  status: z.string(),
  note: z.string().nullable(),
  created_at: z.string(),
})

/** 健診実施記録一覧のレスポンス。 */
export const zAppHealthCheckupList = z.object({
  data: z.array(zAppHealthCheckup),
  total: z.number(),
})
