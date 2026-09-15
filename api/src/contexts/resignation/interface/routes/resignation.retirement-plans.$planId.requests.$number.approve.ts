import { createResignationRetirementDecisionHandlers } from "@/contexts/resignation/interface/operations/create-resignation-retirement-decision-handlers"
import { resignationFactory } from "@/contexts/resignation/interface/request-environment/resignation-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 現在の人間の認証とCompanyの承認資格でSystemの判断を記録する
export const POST = resignationFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createResignationRetirementDecisionHandlers("approve"),
)
