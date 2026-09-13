import { createLicensePreservationDecisionHandlers } from "@/contexts/software-license/interface/operations/create-license-preservation-decision-handlers"
import { softwareLicenseFactory } from "@/contexts/software-license/interface/request-environment/software-license-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 現在の人間の認証とCompanyの承認資格でSystemの判断を記録する
export const POST = softwareLicenseFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createLicensePreservationDecisionHandlers("approve"),
)
