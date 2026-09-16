import { createPartnerRetirementDecisionHandlers } from "@/contexts/partner/interface/operations/create-partner-retirement-decision-handlers"
import { partnerFactory } from "@/contexts/partner/interface/request-environment/partner-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 現在の人間の認証とCompanyの承認資格でSystemの判断を記録する
export const POST = partnerFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createPartnerRetirementDecisionHandlers("approve"),
)
