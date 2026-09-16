import { createMeetingRetirementDecisionHandlers } from "@/contexts/meeting/interface/operations/create-meeting-retirement-decision-handlers"
import { meetingFactory } from "@/contexts/meeting/interface/request-environment/meeting-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 現在の人間の認証とCompanyの承認資格でSystemの判断を記録する
export const POST = meetingFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createMeetingRetirementDecisionHandlers("reject"),
)
