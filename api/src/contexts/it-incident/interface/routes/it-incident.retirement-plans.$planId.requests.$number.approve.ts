import { createItIncidentRetirementDecisionHandlers } from "@/contexts/it-incident/interface/operations/create-it-incident-retirement-decision-handlers"
import { itIncidentFactory } from "@/contexts/it-incident/interface/request-environment/it-incident-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 現在の人間の認証とCompanyの承認資格でSystemの判断を記録する
export const POST = itIncidentFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createItIncidentRetirementDecisionHandlers("approve"),
)
