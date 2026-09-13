import { attendanceFactory } from "@/contexts/attendance/interface/request-environment/attendance-factory"
import { createAttendanceSourceFreezeHandlers } from "@/contexts/attendance/interface/operations/create-attendance-source-freeze-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の技術管理権限と再認証を解除時にも検査する
export const POST = attendanceFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createAttendanceSourceFreezeHandlers("release"),
)
