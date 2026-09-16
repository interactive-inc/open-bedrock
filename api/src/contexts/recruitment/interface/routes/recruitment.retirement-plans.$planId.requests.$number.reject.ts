import { createRecruitmentRetirementDecisionHandlers } from "@/contexts/recruitment/interface/operations/create-recruitment-retirement-decision-handlers"
import { recruitmentFactory } from "@/contexts/recruitment/interface/request-environment/recruitment-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 現在の人間の認証とCompanyの承認資格でSystemの判断を記録する
export const POST = recruitmentFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createRecruitmentRetirementDecisionHandlers("reject"),
)
