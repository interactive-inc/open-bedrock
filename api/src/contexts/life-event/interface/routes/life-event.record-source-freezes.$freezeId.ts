import { lifeEventFactory } from "@/contexts/life-event/interface/request-environment/life-event-factory"
import { createLifeEventSourceFreezeReadHandlers } from "@/contexts/life-event/interface/operations/create-life-event-source-freeze-read-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の現在の技術管理権限を読取時にも検査する
export const GET = lifeEventFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createLifeEventSourceFreezeReadHandlers(),
)
