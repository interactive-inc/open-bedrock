import { shiftFactory } from "@/contexts/shift/interface/request-environment/shift-factory"
import { createShiftSourceFreezeHandlers } from "@/contexts/shift/interface/operations/create-shift-source-freeze-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の技術管理権限と再認証を保存時にも検査する
export const POST = shiftFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createShiftSourceFreezeHandlers("create"),
)
