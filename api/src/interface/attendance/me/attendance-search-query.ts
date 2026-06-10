import { z } from "zod"

export const attendanceSearchQuerySchema = z.object({
  employee_id: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
})

export type AttendanceSearchQuery = z.infer<typeof attendanceSearchQuerySchema>
