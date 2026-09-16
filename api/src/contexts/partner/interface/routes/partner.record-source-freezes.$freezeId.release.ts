import { partnerFactory } from "@/contexts/partner/interface/request-environment/partner-factory"
import { createPartnerSourceFreezeHandlers } from "@/contexts/partner/interface/operations/create-partner-source-freeze-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の技術管理権限と再認証を解除時にも検査する
export const POST = partnerFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createPartnerSourceFreezeHandlers("release"),
)
