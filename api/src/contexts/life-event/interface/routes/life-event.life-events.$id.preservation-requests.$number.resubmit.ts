import { createLifeEventPreservationSubmissionHandlers } from "@/contexts/life-event/interface/operations/create-life-event-preservation-submission-handlers"
import { lifeEventFactory } from "@/contexts/life-event/interface/request-environment/life-event-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 保全権限と原記録の管理資格、本文、Company候補を保存時にも検査する
export const POST = lifeEventFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createLifeEventPreservationSubmissionHandlers("resubmit"),
)
