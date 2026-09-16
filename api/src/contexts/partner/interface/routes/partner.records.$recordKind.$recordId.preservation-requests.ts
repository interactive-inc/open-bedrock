import { createPartnerPreservationSubmissionHandlers } from "@/contexts/partner/interface/operations/create-partner-preservation-submission-handlers"
import { partnerFactory } from "@/contexts/partner/interface/request-environment/partner-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 保全権限と原記録の管理資格、本文、Company候補を保存時にも検査する
export const POST = partnerFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createPartnerPreservationSubmissionHandlers("create"),
)
