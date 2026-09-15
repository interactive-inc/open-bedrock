import { softwareLicenseFactory } from "@/contexts/software-license/interface/request-environment/software-license-factory"
import { createSoftwareLicenseSourceFreezeHandlers } from "@/contexts/software-license/interface/operations/create-software-license-source-freeze-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の技術管理権限と再認証を解除時にも検査する
export const POST = softwareLicenseFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createSoftwareLicenseSourceFreezeHandlers("release"),
)
