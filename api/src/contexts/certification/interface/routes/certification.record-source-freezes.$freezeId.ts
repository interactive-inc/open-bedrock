import { certificationFactory } from "@/contexts/certification/interface/request-environment/certification-factory"
import { createCertificationSourceFreezeReadHandlers } from "@/contexts/certification/interface/operations/create-certification-source-freeze-read-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の現在の技術管理権限を読取時にも検査する
export const GET = certificationFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createCertificationSourceFreezeReadHandlers(),
)
