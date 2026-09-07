import { uuidSchema } from "@/lib/uuid/uuid.schema"
import { z } from "zod"

/** 文書台帳一覧の 1 件。 */
export const zAppDocumentListItem = z.object({
  id: uuidSchema,
  title: z.string(),
  category: z.string().nullable(),
  location: z.string(),
  partner_code: z.string().nullable(),
  expires_on: z.string().nullable(),
  note: z.string().nullable(),
  created_at: z.string(),
})

/** 文書台帳一覧のレスポンス。 */
export const zAppDocumentList = z.object({
  data: z.array(zAppDocumentListItem),
  total: z.number(),
})

/** 文書台帳 1 件の作成・更新レスポンス。 */
export const zAppDocument = z.object({
  id: uuidSchema,
  title: z.string(),
  category: z.string().nullable(),
  location: z.string(),
  partner_code: z.string().nullable(),
  expires_on: z.string().nullable(),
  note: z.string().nullable(),
  created_at: z.string(),
})
