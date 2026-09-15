import { trainingFactory } from "@/contexts/training/interface/request-environment/training-factory"
import { createTrainingSourceFreezeHandlers } from "@/contexts/training/interface/operations/create-training-source-freeze-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の技術管理権限と再認証を解除時にも検査する
export const POST = trainingFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createTrainingSourceFreezeHandlers("release"),
)
