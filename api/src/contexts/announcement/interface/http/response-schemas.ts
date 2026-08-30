import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { z } from "zod"

/** 社内アナウンス一覧の 1 件。 */
export const zAppAnnouncementListItem = z.object({
  id: z.number(),
  title: z.string(),
  status: z.string(),
  published_on: z.string().nullable(),
  author_employee_id: zEmployeeId,
  created_at: z.string(),
})

/** 社内アナウンス一覧のレスポンス。 */
export const zAppAnnouncementList = z.object({
  data: z.array(zAppAnnouncementListItem),
  total: z.number(),
})

/** 社内アナウンス 1 件の詳細・作成・更新レスポンス。 */
export const zAppAnnouncement = z.object({
  id: z.number(),
  title: z.string(),
  body_md: z.string(),
  status: z.string(),
  published_on: z.string().nullable(),
  author_employee_id: zEmployeeId,
  created_at: z.string(),
})
