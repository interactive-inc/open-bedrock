import { z } from "zod"

export const attendanceSearchQuerySchema = z.object({
  // null は org:manage による全社スコープ。それ以外は明示的な対象集合。
  employeeIds: z.array(z.number()).nullable(),
  from: z.string().nullable(),
  to: z.string().nullable(),
})

export type AttendanceSearchQuery = z.infer<typeof attendanceSearchQuerySchema>
