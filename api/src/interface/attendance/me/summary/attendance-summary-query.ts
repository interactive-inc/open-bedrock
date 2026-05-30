import { z } from "zod"

export const attendanceSummaryQuerySchema = z.object({
  month: z.string().optional(),
})

export type AttendanceSummaryQuery = z.infer<typeof attendanceSummaryQuerySchema>
