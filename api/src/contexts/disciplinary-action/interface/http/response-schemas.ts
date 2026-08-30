import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { z } from "zod"

/** 懲戒の記録 1 件のレスポンス（非公開。本人にも見せない設計）。 */
export const zAppDisciplinaryAction = z.object({
  id: z.number(),
  employee_id: zEmployeeId,
  kind: z.string(),
  summary: z.string(),
  decided_on: z.string(),
  created_at: z.string(),
})

/** 懲戒の記録一覧のレスポンス。 */
export const zAppDisciplinaryActionList = z.object({
  data: z.array(zAppDisciplinaryAction),
  total: z.number(),
})
