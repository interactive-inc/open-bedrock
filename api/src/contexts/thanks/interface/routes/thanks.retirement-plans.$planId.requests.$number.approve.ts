import { createThanksRetirementDecisionHandlers } from "@/contexts/thanks/interface/operations/create-thanks-retirement-decision-handlers"
import { thanksFactory } from "@/contexts/thanks/interface/request-environment/thanks-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 現在の人間の認証とCompanyの承認資格でSystemの判断を記録する
export const POST = thanksFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createThanksRetirementDecisionHandlers("approve"),
)
