import { z } from "zod"

export const attendanceSearchQuerySchema = z.object({
  employeeId: z.number().nullable(),
  from: z.string().nullable(),
  to: z.string().nullable(),
})

export type AttendanceSearchQuery = z.infer<typeof attendanceSearchQuerySchema>
