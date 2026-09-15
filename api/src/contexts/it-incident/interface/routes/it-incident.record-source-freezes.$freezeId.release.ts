import { itIncidentFactory } from "@/contexts/it-incident/interface/request-environment/it-incident-factory"
import { createItIncidentSourceFreezeHandlers } from "@/contexts/it-incident/interface/operations/create-it-incident-source-freeze-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の技術管理権限と再認証を解除時にも検査する
export const POST = itIncidentFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createItIncidentSourceFreezeHandlers("release"),
)
