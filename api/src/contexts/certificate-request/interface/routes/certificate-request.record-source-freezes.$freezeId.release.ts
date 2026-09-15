import { certificateRequestFactory } from "@/contexts/certificate-request/interface/request-environment/certificate-request-factory"
import { createCertificateRequestSourceFreezeHandlers } from "@/contexts/certificate-request/interface/operations/create-certificate-request-source-freeze-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の技術管理権限と再認証を解除時にも検査する
export const POST = certificateRequestFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createCertificateRequestSourceFreezeHandlers("release"),
)
