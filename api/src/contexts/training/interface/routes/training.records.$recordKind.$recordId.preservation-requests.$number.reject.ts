import { createTrainingPreservationDecisionHandlers } from "@/contexts/training/interface/operations/create-training-preservation-decision-handlers"
import { trainingFactory } from "@/contexts/training/interface/request-environment/training-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 現在の人間の認証とCompanyの承認資格でSystemの判断を記録する
export const POST = trainingFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createTrainingPreservationDecisionHandlers("reject"),
)
