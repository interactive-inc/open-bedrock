import { lifeEventFactory } from "@/contexts/life-event/interface/request-environment/life-event-factory"
import { createLifeEventSourceFreezeHandlers } from "@/contexts/life-event/interface/operations/create-life-event-source-freeze-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の技術管理権限と再認証を保存時にも検査する
export const POST = lifeEventFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createLifeEventSourceFreezeHandlers("create"),
)
