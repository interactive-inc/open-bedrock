import { certificateRequestFactory } from "@/contexts/certificate-request/interface/request-environment/certificate-request-factory"
import { createCertificateRequestSourceFreezeReadHandlers } from "@/contexts/certificate-request/interface/operations/create-certificate-request-source-freeze-read-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の現在の技術管理権限を読取時にも検査する
export const GET = certificateRequestFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createCertificateRequestSourceFreezeReadHandlers(),
)
