import { createLifeEventRetirementDecisionHandlers } from "@/contexts/life-event/interface/operations/create-life-event-retirement-decision-handlers"
import { lifeEventFactory } from "@/contexts/life-event/interface/request-environment/life-event-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 現在の人間の認証とCompanyの承認資格でSystemの判断を記録する
export const POST = lifeEventFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createLifeEventRetirementDecisionHandlers("approve"),
)
