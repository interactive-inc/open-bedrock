import { commendationFactory } from "@/contexts/commendation/interface/request-environment/commendation-factory"
import { createCommendationSourceFreezeReadHandlers } from "@/contexts/commendation/interface/operations/create-commendation-source-freeze-read-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の現在の技術管理権限を読取時にも検査する
export const GET = commendationFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createCommendationSourceFreezeReadHandlers(),
)
