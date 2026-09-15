import { itIncidentFactory } from "@/contexts/it-incident/interface/request-environment/it-incident-factory"
import { createItIncidentSourceFreezeReadHandlers } from "@/contexts/it-incident/interface/operations/create-it-incident-source-freeze-read-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の現在の技術管理権限を読取時にも検査する
export const GET = itIncidentFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createItIncidentSourceFreezeReadHandlers(),
)
