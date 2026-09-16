import { createRegulationPreservationSubmissionHandlers } from "@/contexts/regulation/interface/operations/create-regulation-preservation-submission-handlers"
import { regulationFactory } from "@/contexts/regulation/interface/request-environment/regulation-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 保全権限と原記録の管理資格、本文、Company候補を保存時にも検査する
export const POST = regulationFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createRegulationPreservationSubmissionHandlers("create"),
)
