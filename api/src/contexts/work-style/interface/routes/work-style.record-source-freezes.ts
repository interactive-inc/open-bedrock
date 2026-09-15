import { employeeWorkStyleFactory } from "@/contexts/work-style/interface/request-environment/work-style-factory"
import { createEmployeeWorkStyleSourceFreezeHandlers } from "@/contexts/work-style/interface/operations/create-work-style-source-freeze-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の技術管理権限と再認証を保存時にも検査する
export const POST = employeeWorkStyleFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createEmployeeWorkStyleSourceFreezeHandlers("create"),
)
