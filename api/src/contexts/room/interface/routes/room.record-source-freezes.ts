import { roomFactory } from "@/contexts/room/interface/request-environment/room-factory"
import { createRoomSourceFreezeHandlers } from "@/contexts/room/interface/operations/create-room-source-freeze-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の技術管理権限と再認証を保存時にも検査する
export const POST = roomFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createRoomSourceFreezeHandlers("create"),
)
