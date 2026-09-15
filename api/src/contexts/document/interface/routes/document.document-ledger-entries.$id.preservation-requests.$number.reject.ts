import { createDocumentPreservationDecisionHandlers } from "@/contexts/document/interface/operations/create-document-preservation-decision-handlers"
import { documentFactory } from "@/contexts/document/interface/request-environment/document-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 現在の人間の認証とCompanyの承認資格でSystemの判断を記録する
export const POST = documentFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createDocumentPreservationDecisionHandlers("reject"),
)
