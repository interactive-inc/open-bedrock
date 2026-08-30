import { z } from "zod"

/** 1on1 1 件のレスポンス。参加者名込み。 */
export const zAppOneOnOne = z.object({
  id: z.string(),
  held_at: z.string(),
  member_name: z.string(),
  manager_name: z.string(),
  topics: z.string().nullable(),
  manager_note: z.string().nullable(),
  next_action: z.string().nullable(),
})

/** 1on1 一覧のレスポンス。 */
export const zAppOneOnOneList = z.object({
  data: z.array(zAppOneOnOne),
  total: z.number(),
})
