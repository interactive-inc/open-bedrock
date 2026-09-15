import { thanksFactory } from "@/contexts/thanks/interface/request-environment/thanks-factory"
import { createThanksSourceFreezeHandlers } from "@/contexts/thanks/interface/operations/create-thanks-source-freeze-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の技術管理権限と再認証を解除時にも検査する
export const POST = thanksFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createThanksSourceFreezeHandlers("release"),
)
