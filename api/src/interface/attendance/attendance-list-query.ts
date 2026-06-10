import { z } from "zod"

export const attendanceListQuerySchema = z.object({
  employee_id: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
})

export type AttendanceListQuery = z.infer<typeof attendanceListQuerySchema>
