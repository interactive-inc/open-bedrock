import { disciplinaryActionFactory } from "@/contexts/disciplinary-action/interface/request-environment/disciplinary-action-factory"
import { createDisciplinaryActionSourceFreezeHandlers } from "@/contexts/disciplinary-action/interface/operations/create-disciplinary-action-source-freeze-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の技術管理権限と再認証を保存時にも検査する
export const POST = disciplinaryActionFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createDisciplinaryActionSourceFreezeHandlers("create"),
)
