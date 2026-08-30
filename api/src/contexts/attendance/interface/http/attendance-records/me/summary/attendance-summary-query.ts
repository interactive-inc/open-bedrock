import { yearMonth } from "@/contexts/attendance/interface/http/year-month.schema"
import { z } from "zod"

export const attendanceSummaryQuerySchema = z.object({
  month: yearMonth.optional(),
})

export type AttendanceSummaryQuery = z.infer<typeof attendanceSummaryQuerySchema>
