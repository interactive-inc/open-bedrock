import { surveyFactory } from "@/contexts/survey/interface/request-environment/survey-factory"
import { createSurveySourceFreezeHandlers } from "@/contexts/survey/interface/operations/create-survey-source-freeze-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の技術管理権限と再認証を保存時にも検査する
export const POST = surveyFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createSurveySourceFreezeHandlers("create"),
)
