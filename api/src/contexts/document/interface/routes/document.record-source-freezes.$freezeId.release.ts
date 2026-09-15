import { documentFactory } from "@/contexts/document/interface/request-environment/document-factory"
import { createDocumentSourceFreezeHandlers } from "@/contexts/document/interface/operations/create-document-source-freeze-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の技術管理権限と再認証を解除時にも検査する
export const POST = documentFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createDocumentSourceFreezeHandlers("release"),
)
