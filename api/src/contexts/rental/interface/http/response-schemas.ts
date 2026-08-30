import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { z } from "zod"

/** ===== rental ===== */
export const zAppRentalReservation = z.object({
  id: z.string(),
  requester_id: zEmployeeId,
  item_name: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  purpose: z.string().nullable(),
  status: z.string(),
  created_at: z.string(),
})

export const zAppRentalReservationList = z.object({
  data: z.array(zAppRentalReservation),
  total: z.number(),
})
