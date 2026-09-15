import { knowledgeFactory } from "@/contexts/knowledge/interface/request-environment/knowledge-factory"
import { createKnowledgeSourceFreezeHandlers } from "@/contexts/knowledge/interface/operations/create-knowledge-source-freeze-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の技術管理権限と再認証を解除時にも検査する
export const POST = knowledgeFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createKnowledgeSourceFreezeHandlers("release"),
)
