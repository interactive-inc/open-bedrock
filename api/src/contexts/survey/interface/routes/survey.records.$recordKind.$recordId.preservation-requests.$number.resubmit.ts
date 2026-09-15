import { createSurveyPreservationSubmissionHandlers } from "@/contexts/survey/interface/operations/create-survey-preservation-submission-handlers"
import { surveyFactory } from "@/contexts/survey/interface/request-environment/survey-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 保全権限と原記録の管理資格、本文、Company候補を保存時にも検査する
export const POST = surveyFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createSurveyPreservationSubmissionHandlers("resubmit"),
)
