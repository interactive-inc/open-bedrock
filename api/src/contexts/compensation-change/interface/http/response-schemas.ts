import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { z } from "zod"

/** 給与改定記録 1 件のレスポンス。基本給・前回基本給・適用日の事実のみ。 */
export const zAppSalaryRevision = z.object({
  id: z.number(),
  employee_id: zEmployeeId,
  effective_date: z.string(),
  previous_base_salary: z.number(),
  new_base_salary: z.number(),
  reason: z.string().nullable(),
  created_at: z.string(),
})

/** 給与改定記録一覧のレスポンス。 */
export const zAppSalaryRevisionList = z.object({
  data: z.array(zAppSalaryRevision),
  total: z.number(),
})
