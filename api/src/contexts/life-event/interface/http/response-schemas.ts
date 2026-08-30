import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { lifeEventTypeSchema } from "@/contexts/life-event/domain/definitions/life-event-type.definition"
import { z } from "zod"

/** ===== life-event ===== */
export const zAppLifeEvent = z.object({
  id: z.string(),
  employee_id: zEmployeeId,
  event_type: lifeEventTypeSchema,
  event_date: z.string(),
  detail: z.string().nullable(),
  status: z.string(),
  created_at: z.string(),
})

export const zAppLifeEventList = z.object({
  data: z.array(zAppLifeEvent),
  total: z.number(),
})
