import { uuidSchema } from "@/lib/uuid/uuid.schema"
import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { z } from "zod"

/** 従業員の勤務形態の 1 区分（期間つき）。制度の適法性判定はしない。 */
export const zAppEmployeeWorkStyle = z.object({
  id: uuidSchema,
  employee_id: zEmployeeId,
  style: z.enum(["regular", "flextime", "discretionary", "shift"]),
  starts_on: z.string(),
  ends_on: z.string().nullable(),
  note: z.string().nullable(),
  created_at: z.string(),
})

/** 従業員の勤務形態一覧のレスポンス。 */
export const zAppEmployeeWorkStyleList = z.object({
  data: z.array(zAppEmployeeWorkStyle),
  total: z.number(),
})
