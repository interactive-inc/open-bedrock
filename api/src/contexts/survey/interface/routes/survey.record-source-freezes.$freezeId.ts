import { surveyFactory } from "@/contexts/survey/interface/request-environment/survey-factory"
import { createSurveySourceFreezeReadHandlers } from "@/contexts/survey/interface/operations/create-survey-source-freeze-read-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の現在の技術管理権限を読取時にも検査する
export const GET = surveyFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createSurveySourceFreezeReadHandlers(),
)
