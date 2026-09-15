import { antisocialCheckFactory } from "@/contexts/antisocial-check/interface/request-environment/antisocial-check-factory"
import { createAntisocialCheckSourceFreezeHandlers } from "@/contexts/antisocial-check/interface/operations/create-antisocial-check-source-freeze-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の技術管理権限と再認証を保存時にも検査する
export const POST = antisocialCheckFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createAntisocialCheckSourceFreezeHandlers("create"),
)
