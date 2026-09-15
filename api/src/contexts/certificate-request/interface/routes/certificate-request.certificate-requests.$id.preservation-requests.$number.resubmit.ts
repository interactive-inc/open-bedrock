import { createCertificateRequestPreservationSubmissionHandlers } from "@/contexts/certificate-request/interface/operations/create-certificate-request-preservation-submission-handlers"
import { certificateRequestFactory } from "@/contexts/certificate-request/interface/request-environment/certificate-request-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 保全権限と原記録の管理資格、本文、Company候補を保存時にも検査する
export const POST = certificateRequestFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createCertificateRequestPreservationSubmissionHandlers("resubmit"),
)
