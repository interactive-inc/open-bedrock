import { commendationFactory } from "@/contexts/commendation/interface/request-environment/commendation-factory"
import { createCommendationSourceFreezeHandlers } from "@/contexts/commendation/interface/operations/create-commendation-source-freeze-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の技術管理権限と再認証を保存時にも検査する
export const POST = commendationFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createCommendationSourceFreezeHandlers("create"),
)
