import { createLeavePreservationDecisionHandlers } from "@/contexts/leave/interface/operations/create-leave-preservation-decision-handlers"
import { leaveFactory } from "@/contexts/leave/interface/request-environment/leave-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 現在の人間の認証とCompanyの承認資格でSystemの判断を記録する
export const POST = leaveFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createLeavePreservationDecisionHandlers("approve"),
)
