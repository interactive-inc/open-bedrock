import { createOneOnOneRetirementDecisionHandlers } from "@/contexts/one-on-one/interface/operations/create-one-on-one-retirement-decision-handlers"
import { oneOnOneFactory } from "@/contexts/one-on-one/interface/request-environment/one-on-one-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 現在の人間の認証とCompanyの承認資格でSystemの判断を記録する
export const POST = oneOnOneFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createOneOnOneRetirementDecisionHandlers("reject"),
)
