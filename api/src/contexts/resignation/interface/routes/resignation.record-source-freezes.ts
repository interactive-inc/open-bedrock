import { resignationFactory } from "@/contexts/resignation/interface/request-environment/resignation-factory"
import { createResignationSourceFreezeHandlers } from "@/contexts/resignation/interface/operations/create-resignation-source-freeze-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の技術管理権限と再認証を保存時にも検査する
export const POST = resignationFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createResignationSourceFreezeHandlers("create"),
)
