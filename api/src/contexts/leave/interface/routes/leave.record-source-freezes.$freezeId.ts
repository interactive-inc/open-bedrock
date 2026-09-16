import { leaveFactory } from "@/contexts/leave/interface/request-environment/leave-factory"
import { createLeaveSourceFreezeReadHandlers } from "@/contexts/leave/interface/operations/create-leave-source-freeze-read-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の現在の技術管理権限を読取時にも検査する
export const GET = leaveFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createLeaveSourceFreezeReadHandlers(),
)
