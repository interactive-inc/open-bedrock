import { createRingiRetirementDecisionHandlers } from "@/contexts/ringi/interface/operations/create-ringi-retirement-decision-handlers"
import { ringiFactory } from "@/contexts/ringi/interface/request-environment/ringi-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 現在の人間の認証とCompanyの承認資格でSystemの判断を記録する
export const POST = ringiFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createRingiRetirementDecisionHandlers("approve"),
)
