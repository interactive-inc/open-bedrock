import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { z } from "zod"

/** 証明書発行依頼 1 件のレスポンス。 */
export const zAppCertificateRequest = z.object({
  id: z.string(),
  requester_id: zEmployeeId,
  certificate_type: z.string(),
  submit_to: z.string().nullable(),
  needed_by: z.string().nullable(),
  note: z.string().nullable(),
  status: z.string(),
  created_at: z.string(),
})

export type AppCertificateRequest = z.infer<typeof zAppCertificateRequest>

/** 証明書発行依頼一覧のレスポンス。 */
export const zAppCertificateRequestList = z.object({
  data: z.array(zAppCertificateRequest),
  total: z.number(),
})
