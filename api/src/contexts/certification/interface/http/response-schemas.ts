import { uuidSchema } from "@/lib/uuid/uuid.schema"
import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { z } from "zod"

/** 資格マスタ 1 件のレスポンス。 */
export const zAppCertification = z.object({
  id: uuidSchema,
  code: z.string(),
  name: z.string(),
  issuer: z.string().nullable(),
  description: z.string().nullable(),
  created_at: z.string(),
})

/** 資格マスタ一覧のレスポンス。 */
export const zAppCertificationList = z.object({
  data: z.array(zAppCertification),
  total: z.number(),
})

/** 従業員の資格保有記録 1 件のレスポンス。 */
export const zAppEmployeeCertification = z.object({
  id: uuidSchema,
  employee_id: zEmployeeId,
  certification_id: uuidSchema,
  acquired_on: z.string(),
  expires_on: z.string().nullable(),
  note: z.string().nullable(),
  created_at: z.string(),
})

/** 資格保有記録一覧のレスポンス。 */
export const zAppEmployeeCertificationList = z.object({
  data: z.array(zAppEmployeeCertification),
  total: z.number(),
})
