import { createSkillPreservationDecisionHandlers } from "@/contexts/skill/interface/operations/create-skill-preservation-decision-handlers"
import { skillFactory } from "@/contexts/skill/interface/request-environment/skill-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 現在の人間の認証とCompanyの承認資格でSystemの判断を記録する
export const POST = skillFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createSkillPreservationDecisionHandlers("approve"),
)
