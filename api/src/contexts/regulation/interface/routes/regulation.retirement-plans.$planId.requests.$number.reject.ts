import { createRegulationRetirementDecisionHandlers } from "@/contexts/regulation/interface/operations/create-regulation-retirement-decision-handlers"
import { regulationFactory } from "@/contexts/regulation/interface/request-environment/regulation-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 現在の人間の認証とCompanyの承認資格でSystemの判断を記録する
export const POST = regulationFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createRegulationRetirementDecisionHandlers("reject"),
)
