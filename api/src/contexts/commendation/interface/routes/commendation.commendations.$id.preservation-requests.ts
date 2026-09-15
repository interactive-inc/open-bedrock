import { createCommendationPreservationSubmissionHandlers } from "@/contexts/commendation/interface/operations/create-commendation-preservation-submission-handlers"
import { commendationFactory } from "@/contexts/commendation/interface/request-environment/commendation-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 保全権限と原記録の管理資格、本文、Company候補を保存時にも検査する
export const POST = commendationFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createCommendationPreservationSubmissionHandlers("create"),
)
