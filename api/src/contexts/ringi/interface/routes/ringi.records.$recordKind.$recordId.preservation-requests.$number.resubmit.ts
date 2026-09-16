import { createRingiPreservationSubmissionHandlers } from "@/contexts/ringi/interface/operations/create-ringi-preservation-submission-handlers"
import { ringiFactory } from "@/contexts/ringi/interface/request-environment/ringi-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 保全権限と原記録の管理資格、本文、Company候補を保存時にも検査する
export const POST = ringiFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createRingiPreservationSubmissionHandlers("resubmit"),
)
