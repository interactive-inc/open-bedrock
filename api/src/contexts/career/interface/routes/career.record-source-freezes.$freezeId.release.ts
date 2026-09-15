import { careerFactory } from "@/contexts/career/interface/request-environment/career-factory"
import { createCareerSourceFreezeHandlers } from "@/contexts/career/interface/operations/create-career-source-freeze-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の技術管理権限と再認証を解除時にも検査する
export const POST = careerFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createCareerSourceFreezeHandlers("release"),
)
