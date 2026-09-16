import { ringiFactory } from "@/contexts/ringi/interface/request-environment/ringi-factory"
import { createRingiSourceFreezeHandlers } from "@/contexts/ringi/interface/operations/create-ringi-source-freeze-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の技術管理権限と再認証を保存時にも検査する
export const POST = ringiFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createRingiSourceFreezeHandlers("create"),
)
