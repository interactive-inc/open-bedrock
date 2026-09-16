import { leaveFactory } from "@/contexts/leave/interface/request-environment/leave-factory"
import { createLeaveSourceFreezeHandlers } from "@/contexts/leave/interface/operations/create-leave-source-freeze-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の技術管理権限と再認証を保存時にも検査する
export const POST = leaveFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createLeaveSourceFreezeHandlers("create"),
)
