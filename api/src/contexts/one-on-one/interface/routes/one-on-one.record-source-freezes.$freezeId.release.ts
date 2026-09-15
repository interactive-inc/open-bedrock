import { oneOnOneFactory } from "@/contexts/one-on-one/interface/request-environment/one-on-one-factory"
import { createOneOnOneSourceFreezeHandlers } from "@/contexts/one-on-one/interface/operations/create-one-on-one-source-freeze-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の技術管理権限と再認証を解除時にも検査する
export const POST = oneOnOneFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createOneOnOneSourceFreezeHandlers("release"),
)
