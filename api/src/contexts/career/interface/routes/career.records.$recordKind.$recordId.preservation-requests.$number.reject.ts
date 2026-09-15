import { createCareerPreservationDecisionHandlers } from "@/contexts/career/interface/operations/create-career-preservation-decision-handlers"
import { careerFactory } from "@/contexts/career/interface/request-environment/career-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 現在の人間の認証とCompanyの承認資格でSystemの判断を記録する
export const POST = careerFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createCareerPreservationDecisionHandlers("reject"),
)
