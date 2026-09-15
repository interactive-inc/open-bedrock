import { createAntisocialCheckPreservationSubmissionHandlers } from "@/contexts/antisocial-check/interface/operations/create-antisocial-check-preservation-submission-handlers"
import { antisocialCheckFactory } from "@/contexts/antisocial-check/interface/request-environment/antisocial-check-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 保全権限と原記録の管理資格、本文、Company候補を保存時にも検査する
export const POST = antisocialCheckFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createAntisocialCheckPreservationSubmissionHandlers("create"),
)
