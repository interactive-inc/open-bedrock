import { createWorkAccidentPreservationSubmissionHandlers } from "@/contexts/work-accident/interface/operations/create-work-accident-preservation-submission-handlers"
import { workAccidentFactory } from "@/contexts/work-accident/interface/request-environment/work-accident-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 保全権限と原記録の管理資格、本文、Company候補を保存時にも検査する
export const POST = workAccidentFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createWorkAccidentPreservationSubmissionHandlers("resubmit"),
)
