import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { z } from "zod"

/** ===== family-care-leave ===== */
export const zAppFamilyCareLeave = z.object({
  id: z.string(),
  employee_id: zEmployeeId,
  leave_kind: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  note: z.string().nullable(),
  status: z.enum(["requested", "approved", "cancelled"]),
  created_at: z.string(),
})

export const zAppFamilyCareLeaveList = z.object({
  data: z.array(zAppFamilyCareLeave),
  total: z.number(),
})
