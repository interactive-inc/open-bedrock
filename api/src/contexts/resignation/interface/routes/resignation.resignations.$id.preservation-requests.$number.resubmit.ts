import { createResignationPreservationSubmissionHandlers } from "@/contexts/resignation/interface/operations/create-resignation-preservation-submission-handlers"
import { resignationFactory } from "@/contexts/resignation/interface/request-environment/resignation-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 保全権限と原記録の管理資格、本文、Company候補を保存時にも検査する
export const POST = resignationFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createResignationPreservationSubmissionHandlers("resubmit"),
)
