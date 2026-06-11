import { yearMonth } from "@/lib/schemas"
import { z } from "zod"

export const attendanceSummaryQuerySchema = z.object({
  month: yearMonth.optional(),
})

export type AttendanceSummaryQuery = z.infer<typeof attendanceSummaryQuerySchema>
