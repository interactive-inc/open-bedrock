import { attendanceFactory } from "@/contexts/attendance/interface/request-environment/attendance-factory"
import { createAttendanceSourceFreezeReadHandlers } from "@/contexts/attendance/interface/operations/create-attendance-source-freeze-read-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の現在の技術管理権限を読取時にも検査する
export const GET = attendanceFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createAttendanceSourceFreezeReadHandlers(),
)
