import { certificationFactory } from "@/contexts/certification/interface/request-environment/certification-factory"
import { createCertificationSourceFreezeHandlers } from "@/contexts/certification/interface/operations/create-certification-source-freeze-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の技術管理権限と再認証を解除時にも検査する
export const POST = certificationFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createCertificationSourceFreezeHandlers("release"),
)
