import { healthCheckupFactory } from "@/contexts/health-checkup/interface/request-environment/health-checkup-factory"
import { createHealthCheckupSourceFreezeHandlers } from "@/contexts/health-checkup/interface/operations/create-health-checkup-source-freeze-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の技術管理権限と再認証を保存時にも検査する
export const POST = healthCheckupFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createHealthCheckupSourceFreezeHandlers("create"),
)
