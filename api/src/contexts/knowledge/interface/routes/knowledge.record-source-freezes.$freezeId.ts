import { knowledgeFactory } from "@/contexts/knowledge/interface/request-environment/knowledge-factory"
import { createKnowledgeSourceFreezeReadHandlers } from "@/contexts/knowledge/interface/operations/create-knowledge-source-freeze-read-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の現在の技術管理権限を読取時にも検査する
export const GET = knowledgeFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createKnowledgeSourceFreezeReadHandlers(),
)
