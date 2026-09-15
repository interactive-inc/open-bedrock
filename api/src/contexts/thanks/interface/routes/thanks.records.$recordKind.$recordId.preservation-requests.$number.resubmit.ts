import { createThanksPreservationSubmissionHandlers } from "@/contexts/thanks/interface/operations/create-thanks-preservation-submission-handlers"
import { thanksFactory } from "@/contexts/thanks/interface/request-environment/thanks-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 保全権限と原記録の管理資格、本文、Company候補を保存時にも検査する
export const POST = thanksFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createThanksPreservationSubmissionHandlers("resubmit"),
)
