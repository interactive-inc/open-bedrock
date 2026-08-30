import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { z } from "zod"

/** ===== business-trip ===== */
export const zAppBusinessTrip = z.object({
  id: z.string(),
  traveler_id: zEmployeeId,
  destination: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  purpose: z.string(),
  estimated_cost: z.number().nullable(),
  status: z.string(),
  created_at: z.string(),
})

export type AppBusinessTrip = z.infer<typeof zAppBusinessTrip>

export const zAppBusinessTripList = z.object({
  data: z.array(zAppBusinessTrip),
  total: z.number(),
})
