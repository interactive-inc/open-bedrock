import { createWorkAccidentPreservationDecisionHandlers } from "@/contexts/work-accident/interface/operations/create-work-accident-preservation-decision-handlers"
import { workAccidentFactory } from "@/contexts/work-accident/interface/request-environment/work-accident-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 現在の人間の認証とCompanyの承認資格でSystemの判断を記録する
export const POST = workAccidentFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createWorkAccidentPreservationDecisionHandlers("approve"),
)
