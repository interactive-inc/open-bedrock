import { createHealthCheckupRetirementDecisionHandlers } from "@/contexts/health-checkup/interface/operations/create-health-checkup-retirement-decision-handlers"
import { healthCheckupFactory } from "@/contexts/health-checkup/interface/request-environment/health-checkup-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 現在の人間の認証とCompanyの承認資格でSystemの判断を記録する
export const POST = healthCheckupFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createHealthCheckupRetirementDecisionHandlers("approve"),
)
