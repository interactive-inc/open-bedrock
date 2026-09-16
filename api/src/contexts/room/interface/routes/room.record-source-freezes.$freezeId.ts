import { roomFactory } from "@/contexts/room/interface/request-environment/room-factory"
import { createRoomSourceFreezeReadHandlers } from "@/contexts/room/interface/operations/create-room-source-freeze-read-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の現在の技術管理権限を読取時にも検査する
export const GET = roomFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createRoomSourceFreezeReadHandlers(),
)
