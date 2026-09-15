import { createItIncidentPreservationSubmissionHandlers } from "@/contexts/it-incident/interface/operations/create-it-incident-preservation-submission-handlers"
import { itIncidentFactory } from "@/contexts/it-incident/interface/request-environment/it-incident-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 保全権限と原記録の管理資格、本文、Company候補を保存時にも検査する
export const POST = itIncidentFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createItIncidentPreservationSubmissionHandlers("create"),
)
