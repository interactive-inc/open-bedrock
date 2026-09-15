import { familyCareLeaveFactory } from "@/contexts/family-care-leave/interface/request-environment/family-care-leave-factory"
import { createFamilyCareLeaveSourceFreezeHandlers } from "@/contexts/family-care-leave/interface/operations/create-family-care-leave-source-freeze-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の技術管理権限と再認証を解除時にも検査する
export const POST = familyCareLeaveFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createFamilyCareLeaveSourceFreezeHandlers("release"),
)
