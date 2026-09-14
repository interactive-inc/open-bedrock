import { createAttendanceRetirementDecisionHandlers } from "@/contexts/attendance/interface/operations/create-attendance-retirement-decision-handlers"
import { attendanceFactory } from "@/contexts/attendance/interface/request-environment/attendance-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 現在の人間の認証とCompanyの承認資格でSystemの判断を記録する
export const POST = attendanceFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createAttendanceRetirementDecisionHandlers("approve"),
)
