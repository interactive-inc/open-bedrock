import { familyCareLeaveFactory } from "@/contexts/family-care-leave/interface/request-environment/family-care-leave-factory"
import { createFamilyCareLeaveSourceFreezeReadHandlers } from "@/contexts/family-care-leave/interface/operations/create-family-care-leave-source-freeze-read-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の現在の技術管理権限を読取時にも検査する
export const GET = familyCareLeaveFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createFamilyCareLeaveSourceFreezeReadHandlers(),
)
