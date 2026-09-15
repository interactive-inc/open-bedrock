import { healthCheckupFactory } from "@/contexts/health-checkup/interface/request-environment/health-checkup-factory"
import { createHealthCheckupSourceFreezeReadHandlers } from "@/contexts/health-checkup/interface/operations/create-health-checkup-source-freeze-read-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の現在の技術管理権限を読取時にも検査する
export const GET = healthCheckupFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createHealthCheckupSourceFreezeReadHandlers(),
)
