import { createDisciplinaryActionPreservationSubmissionHandlers } from "@/contexts/disciplinary-action/interface/operations/create-disciplinary-action-preservation-submission-handlers"
import { disciplinaryActionFactory } from "@/contexts/disciplinary-action/interface/request-environment/disciplinary-action-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 保全権限と原記録の管理資格、本文、Company候補を保存時にも検査する
export const POST = disciplinaryActionFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createDisciplinaryActionPreservationSubmissionHandlers("resubmit"),
)
