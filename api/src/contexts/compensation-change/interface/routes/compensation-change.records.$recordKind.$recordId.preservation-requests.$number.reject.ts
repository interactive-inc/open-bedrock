import { createCompensationChangePreservationDecisionHandlers } from "@/contexts/compensation-change/interface/operations/create-compensation-change-preservation-decision-handlers"
import { compensationChangeFactory } from "@/contexts/compensation-change/interface/request-environment/compensation-change-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 現在の人間の認証とCompanyの承認資格でSystemの判断を記録する
export const POST = compensationChangeFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createCompensationChangePreservationDecisionHandlers("reject"),
)
