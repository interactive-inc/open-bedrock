import { workAccidentFactory } from "@/contexts/work-accident/interface/request-environment/work-accident-factory"
import { createWorkAccidentSourceFreezeReadHandlers } from "@/contexts/work-accident/interface/operations/create-work-accident-source-freeze-read-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の現在の技術管理権限を読取時にも検査する
export const GET = workAccidentFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createWorkAccidentSourceFreezeReadHandlers(),
)
