import { createCertificateRequestPreservationDecisionHandlers } from "@/contexts/certificate-request/interface/operations/create-certificate-request-preservation-decision-handlers"
import { certificateRequestFactory } from "@/contexts/certificate-request/interface/request-environment/certificate-request-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 現在の人間の認証とCompanyの承認資格でSystemの判断を記録する
export const POST = certificateRequestFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createCertificateRequestPreservationDecisionHandlers("approve"),
)
