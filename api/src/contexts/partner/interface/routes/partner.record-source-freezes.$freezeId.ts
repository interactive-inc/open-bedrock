import { partnerFactory } from "@/contexts/partner/interface/request-environment/partner-factory"
import { createPartnerSourceFreezeReadHandlers } from "@/contexts/partner/interface/operations/create-partner-source-freeze-read-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の現在の技術管理権限を読取時にも検査する
export const GET = partnerFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createPartnerSourceFreezeReadHandlers(),
)
