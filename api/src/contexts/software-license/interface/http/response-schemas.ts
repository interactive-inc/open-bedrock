import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { z } from "zod"

/** ライセンス・SaaS 台帳 1 件のレスポンス。 */
export const zAppLicense = z.object({
  id: z.number(),
  name: z.string(),
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
export const zAppLicenseList = z.object({
  data: z.array(zAppLicense),
  total: z.number(),
})
