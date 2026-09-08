import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { z } from "zod"

/** ライセンス・SaaS 台帳 1 件のレスポンス。 */
export const licenseResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
  plan_name: z.string().nullable(),
  revision: z.number().int().nonnegative(),
  vendor: z.string().nullable(),
  category: z.string().nullable(),
  seats: z.number().nullable(),
  renewal_deadline: z.string().nullable(),
  owner_employee_id: zEmployeeId.nullable(),
  note: z.string().nullable(),
  status: z.enum(["active", "cancelled"]),
  created_at: z.string(),
})

/** ライセンス・SaaS 台帳一覧のレスポンス。 */
export const licenseListResponseSchema = z.object({
  data: z.array(licenseResponseSchema),
  total: z.number(),
})
