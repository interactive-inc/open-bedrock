import { z } from "zod"

/** 取引先 1 件のレスポンス。 */
export const zAppPartner = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  category: z.string().nullable(),
  corporate_number: z.string().nullable(),
  note: z.string().nullable(),
  status: z.string(),
  created_at: z.string(),
})

/** 取引先一覧のレスポンス。 */
export const zAppPartnerList = z.object({
  data: z.array(zAppPartner),
  total: z.number(),
})

/** 契約記録 1 件のレスポンス。 */
export const zAppContract = z.object({
  id: z.number(),
  partner_id: z.number(),
  title: z.string(),
  contract_date: z.string(),
  starts_on: z.string().nullable(),
  ends_on: z.string().nullable(),
  renewal_deadline: z.string().nullable(),
  note: z.string().nullable(),
  created_at: z.string(),
})

/** 契約記録一覧のレスポンス。 */
export const zAppContractList = z.object({
  data: z.array(zAppContract),
  total: z.number(),
})
