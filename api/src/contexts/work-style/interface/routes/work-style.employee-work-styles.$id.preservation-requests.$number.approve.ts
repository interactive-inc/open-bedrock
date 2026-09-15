import { createEmployeeWorkStylePreservationDecisionHandlers } from "@/contexts/work-style/interface/operations/create-work-style-preservation-decision-handlers"
import { employeeWorkStyleFactory } from "@/contexts/work-style/interface/request-environment/work-style-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 現在の人間の認証とCompanyの承認資格でSystemの判断を記録する
export const POST = employeeWorkStyleFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createEmployeeWorkStylePreservationDecisionHandlers("approve"),
)
