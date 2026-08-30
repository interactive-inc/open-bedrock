import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { z } from "zod"

/** 労災・事故の発生記録 1 件のレスポンス。 */
export const zAppWorkAccident = z.object({
  id: z.number(),
  occurred_on: z.string(),
  employee_id: zEmployeeId.nullable(),
  location: z.string().nullable(),
  summary: z.string(),
  severity: z.string().nullable(),
  status: z.string(),
  created_at: z.string(),
})

/** 労災・事故の発生記録一覧のレスポンス。 */
export const zAppWorkAccidentList = z.object({
  data: z.array(zAppWorkAccident),
  total: z.number(),
})
