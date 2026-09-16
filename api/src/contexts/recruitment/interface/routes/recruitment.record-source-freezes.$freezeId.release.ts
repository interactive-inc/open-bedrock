import { recruitmentFactory } from "@/contexts/recruitment/interface/request-environment/recruitment-factory"
import { createRecruitmentSourceFreezeHandlers } from "@/contexts/recruitment/interface/operations/create-recruitment-source-freeze-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の技術管理権限と再認証を解除時にも検査する
export const POST = recruitmentFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createRecruitmentSourceFreezeHandlers("release"),
)
