import { z } from "zod"

/** 会社カレンダーの 1 日（会社休日 / 振替出勤日）。通常営業日は含まない。 */
export const zAppCompanyCalendarDay = z.object({
  id: z.number(),
  calendar_date: z.string(),
  kind: z.enum(["holiday", "workday"]),
  name: z.string().nullable(),
  created_at: z.string(),
})

/** 会社カレンダー一覧のレスポンス。 */
export const zAppCompanyCalendarDayList = z.object({
  data: z.array(zAppCompanyCalendarDay),
  total: z.number(),
})
