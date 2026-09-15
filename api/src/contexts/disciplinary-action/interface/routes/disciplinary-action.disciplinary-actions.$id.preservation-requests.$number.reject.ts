import { createDisciplinaryActionPreservationDecisionHandlers } from "@/contexts/disciplinary-action/interface/operations/create-disciplinary-action-preservation-decision-handlers"
import { disciplinaryActionFactory } from "@/contexts/disciplinary-action/interface/request-environment/disciplinary-action-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 現在の人間の認証とCompanyの承認資格でSystemの判断を記録する
export const POST = disciplinaryActionFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createDisciplinaryActionPreservationDecisionHandlers("reject"),
)
