import { createKnowledgeRetirementDecisionHandlers } from "@/contexts/knowledge/interface/operations/create-knowledge-retirement-decision-handlers"
import { knowledgeFactory } from "@/contexts/knowledge/interface/request-environment/knowledge-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 現在の人間の認証とCompanyの承認資格でSystemの判断を記録する
export const POST = knowledgeFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createKnowledgeRetirementDecisionHandlers("approve"),
)
