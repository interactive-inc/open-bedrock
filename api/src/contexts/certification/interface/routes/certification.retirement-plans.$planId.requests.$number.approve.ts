import { createCertificationRetirementDecisionHandlers } from "@/contexts/certification/interface/operations/create-certification-retirement-decision-handlers"
import { certificationFactory } from "@/contexts/certification/interface/request-environment/certification-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 現在の人間の認証とCompanyの承認資格でSystemの判断を記録する
export const POST = certificationFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createCertificationRetirementDecisionHandlers("approve"),
)
