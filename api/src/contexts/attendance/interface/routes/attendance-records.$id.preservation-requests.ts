import { attendanceFactory } from "@/contexts/attendance/interface/request-environment/attendance-factory"
import { createAttendancePreservationSubmissionHandlers } from "@/contexts/attendance/interface/operations/create-attendance-preservation-submission-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 現在の打刻閲覧・保全権限とCompanyの判断候補を保存時にも検査する
export const POST = attendanceFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createAttendancePreservationSubmissionHandlers("create"),
)
