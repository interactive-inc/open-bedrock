import { createSurveyRetirementDecisionHandlers } from "@/contexts/survey/interface/operations/create-survey-retirement-decision-handlers"
import { surveyFactory } from "@/contexts/survey/interface/request-environment/survey-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 現在の人間の認証とCompanyの承認資格でSystemの判断を記録する
export const POST = surveyFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createSurveyRetirementDecisionHandlers("reject"),
)
