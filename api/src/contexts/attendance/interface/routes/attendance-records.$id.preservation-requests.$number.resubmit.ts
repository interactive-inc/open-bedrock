import { attendanceFactory } from "@/contexts/attendance/interface/request-environment/attendance-factory"
import { createAttendancePreservationSubmissionHandlers } from "@/contexts/attendance/interface/operations/create-attendance-preservation-submission-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 本人の終了済み提案と元記録を確認し、新しい会社資格で次版を提出する
export const POST = attendanceFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createAttendancePreservationSubmissionHandlers("resubmit"),
)
