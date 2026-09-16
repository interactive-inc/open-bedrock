import { shiftFactory } from "@/contexts/shift/interface/request-environment/shift-factory"
import { createShiftSourceFreezeReadHandlers } from "@/contexts/shift/interface/operations/create-shift-source-freeze-read-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の現在の技術管理権限を読取時にも検査する
export const GET = shiftFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createShiftSourceFreezeReadHandlers(),
)
