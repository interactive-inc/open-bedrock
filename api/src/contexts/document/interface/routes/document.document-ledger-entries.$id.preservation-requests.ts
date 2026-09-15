import { createDocumentPreservationSubmissionHandlers } from "@/contexts/document/interface/operations/create-document-preservation-submission-handlers"
import { documentFactory } from "@/contexts/document/interface/request-environment/document-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 保全権限と原記録の管理資格、本文、Company候補を保存時にも検査する
export const POST = documentFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createDocumentPreservationSubmissionHandlers("create"),
)
