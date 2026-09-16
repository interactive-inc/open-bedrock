import { createRoomRetirementDecisionHandlers } from "@/contexts/room/interface/operations/create-room-retirement-decision-handlers"
import { roomFactory } from "@/contexts/room/interface/request-environment/room-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 現在の人間の認証とCompanyの承認資格でSystemの判断を記録する
export const POST = roomFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createRoomRetirementDecisionHandlers("approve"),
)
