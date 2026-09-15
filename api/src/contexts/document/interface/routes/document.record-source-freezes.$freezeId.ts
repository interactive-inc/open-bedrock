import { documentFactory } from "@/contexts/document/interface/request-environment/document-factory"
import { createDocumentSourceFreezeReadHandlers } from "@/contexts/document/interface/operations/create-document-source-freeze-read-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の現在の技術管理権限を読取時にも検査する
export const GET = documentFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createDocumentSourceFreezeReadHandlers(),
)
