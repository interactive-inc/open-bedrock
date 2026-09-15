import { createAntisocialCheckPreservationDecisionHandlers } from "@/contexts/antisocial-check/interface/operations/create-antisocial-check-preservation-decision-handlers"
import { antisocialCheckFactory } from "@/contexts/antisocial-check/interface/request-environment/antisocial-check-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 現在の人間の認証とCompanyの承認資格でSystemの判断を記録する
export const POST = antisocialCheckFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createAntisocialCheckPreservationDecisionHandlers("approve"),
)
