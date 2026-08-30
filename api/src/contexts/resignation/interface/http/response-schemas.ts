import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { z } from "zod"

/** ===== resignation ===== */
export const zAppResignation = z.object({
  id: z.string(),
  employee_id: zEmployeeId,
  resignation_date: z.string(),
  last_working_date: z.string().nullable(),
  reason: z.string().nullable(),
  status: z.string(),
  created_at: z.string(),
})

export const zAppResignationList = z.object({
  data: z.array(zAppResignation),
  total: z.number(),
})
