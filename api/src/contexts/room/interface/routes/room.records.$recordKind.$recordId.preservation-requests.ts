import { createRoomPreservationSubmissionHandlers } from "@/contexts/room/interface/operations/create-room-preservation-submission-handlers"
import { roomFactory } from "@/contexts/room/interface/request-environment/room-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 保全権限と原記録の管理資格、本文、Company候補を保存時にも検査する
export const POST = roomFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createRoomPreservationSubmissionHandlers("create"),
)
