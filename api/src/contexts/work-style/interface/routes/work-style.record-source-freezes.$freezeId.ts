import { employeeWorkStyleFactory } from "@/contexts/work-style/interface/request-environment/work-style-factory"
import { createEmployeeWorkStyleSourceFreezeReadHandlers } from "@/contexts/work-style/interface/operations/create-work-style-source-freeze-read-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の現在の技術管理権限を読取時にも検査する
export const GET = employeeWorkStyleFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createEmployeeWorkStyleSourceFreezeReadHandlers(),
)
