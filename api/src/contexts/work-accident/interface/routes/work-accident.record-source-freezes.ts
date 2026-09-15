import { workAccidentFactory } from "@/contexts/work-accident/interface/request-environment/work-accident-factory"
import { createWorkAccidentSourceFreezeHandlers } from "@/contexts/work-accident/interface/operations/create-work-accident-source-freeze-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の技術管理権限と再認証を保存時にも検査する
export const POST = workAccidentFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createWorkAccidentSourceFreezeHandlers("create"),
)
