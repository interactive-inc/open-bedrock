import { isoDate } from "@/lib/schemas"
import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { z } from "zod"

export const attendanceListQuerySchema = z.object({
  employee_id: zEmployeeId.optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
})

export type AttendanceListQuery = z.infer<typeof attendanceListQuerySchema>
