import { createKnowledgePreservationSubmissionHandlers } from "@/contexts/knowledge/interface/operations/create-knowledge-preservation-submission-handlers"
import { knowledgeFactory } from "@/contexts/knowledge/interface/request-environment/knowledge-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 保全権限と原記録の管理資格、本文、Company候補を保存時にも検査する
export const POST = knowledgeFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createKnowledgePreservationSubmissionHandlers("create"),
)
