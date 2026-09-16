import { createLeavePreservationSubmissionHandlers } from "@/contexts/leave/interface/operations/create-leave-preservation-submission-handlers"
import { leaveFactory } from "@/contexts/leave/interface/request-environment/leave-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 保全権限と原記録の管理資格、本文、Company候補を保存時にも検査する
export const POST = leaveFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createLeavePreservationSubmissionHandlers("resubmit"),
)
