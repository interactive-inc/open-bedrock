import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { z } from "zod"

/** 勤怠記録 1 件のレスポンス。 */
export const zAppAttendanceRecord = z.object({
  id: z.number(),
  employee_id: zEmployeeId,
  work_date: z.string(),
  clock_in_at: z.string().nullable(),
  clock_out_at: z.string().nullable(),
  work_minutes: z.number().nullable(),
  status: z.string(),
})

/** 勤怠記録一覧のレスポンス。 */
export const zAppAttendanceRecordList = z.object({
  data: z.array(zAppAttendanceRecord),
  total: z.number(),
})

/** 本人の指定月の勤怠集計レスポンス。 */
export const zAppAttendanceSummary = z.object({
  employee_id: zEmployeeId,
  month: z.string(),
  work_days: z.number(),
  total_work_minutes: z.number(),
})
