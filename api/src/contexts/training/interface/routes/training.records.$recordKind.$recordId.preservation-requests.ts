import { createTrainingPreservationSubmissionHandlers } from "@/contexts/training/interface/operations/create-training-preservation-submission-handlers"
import { trainingFactory } from "@/contexts/training/interface/request-environment/training-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 保全権限と原記録の管理資格、本文、Company候補を保存時にも検査する
export const POST = trainingFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createTrainingPreservationSubmissionHandlers("create"),
)
