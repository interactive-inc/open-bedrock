import { regulationFactory } from "@/contexts/regulation/interface/request-environment/regulation-factory"
import { createRegulationSourceFreezeHandlers } from "@/contexts/regulation/interface/operations/create-regulation-source-freeze-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の技術管理権限と再認証を保存時にも検査する
export const POST = regulationFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createRegulationSourceFreezeHandlers("create"),
)
