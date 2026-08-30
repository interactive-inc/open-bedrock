import { isoDate } from "@/lib/validation/iso-date.schema"
import { z } from "zod"

export const attendanceSearchQuerySchema = z.object({
  employee_id: z.string().optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
})

export type AttendanceSearchQuery = z.infer<typeof attendanceSearchQuerySchema>
