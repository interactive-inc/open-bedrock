import { z } from "zod"

/** 人員計画 1 件のレスポンス。actual_count は同部署の active 在籍数。 */
export const zAppHeadcountPlan = z.object({
  id: z.number(),
  fiscal_year: z.number(),
  department_code: z.string().nullable(),
  planned_count: z.number(),
  actual_count: z.number(),
  note: z.string().nullable(),
  created_at: z.string(),
})

/** 人員計画一覧のレスポンス。 */
export const zAppHeadcountPlanList = z.object({
  data: z.array(zAppHeadcountPlan),
  total: z.number(),
})
