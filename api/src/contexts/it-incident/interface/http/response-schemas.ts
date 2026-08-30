import { z } from "zod"

/** インシデント記録 1 件のレスポンス。 */
export const zAppItIncident = z.object({
  id: z.number(),
  occurred_at: z.string(),
  title: z.string(),
  summary: z.string(),
  severity: z.string().nullable(),
  status: z.enum(["open", "resolved"]),
  resolved_at: z.string().nullable(),
  created_at: z.string(),
})

/** インシデント記録一覧のレスポンス。 */
export const zAppItIncidentList = z.object({
  data: z.array(zAppItIncident),
  total: z.number(),
})
