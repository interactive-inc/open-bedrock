import { disciplinaryActionFactory } from "@/contexts/disciplinary-action/interface/request-environment/disciplinary-action-factory"
import { createDisciplinaryActionSourceFreezeReadHandlers } from "@/contexts/disciplinary-action/interface/operations/create-disciplinary-action-source-freeze-read-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の現在の技術管理権限を読取時にも検査する
export const GET = disciplinaryActionFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createDisciplinaryActionSourceFreezeReadHandlers(),
)
