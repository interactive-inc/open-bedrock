import { createHealthCheckupPreservationSubmissionHandlers } from "@/contexts/health-checkup/interface/operations/create-health-checkup-preservation-submission-handlers"
import { healthCheckupFactory } from "@/contexts/health-checkup/interface/request-environment/health-checkup-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 保全権限と原記録の管理資格、本文、Company候補を保存時にも検査する
export const POST = healthCheckupFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createHealthCheckupPreservationSubmissionHandlers("resubmit"),
)
