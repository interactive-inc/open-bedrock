import { z } from "zod"
import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"

export const attendanceSearchQuerySchema = z.object({
  // null は org:manage による全社スコープ。それ以外は明示的な対象集合。
  employeeIds: z.array(zEmployeeId).nullable(),
  from: z.string().nullable(),
  to: z.string().nullable(),
})

export type AttendanceSearchQuery = z.infer<typeof attendanceSearchQuerySchema>
