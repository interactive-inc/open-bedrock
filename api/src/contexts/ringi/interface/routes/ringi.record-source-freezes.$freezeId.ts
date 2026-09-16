import { ringiFactory } from "@/contexts/ringi/interface/request-environment/ringi-factory"
import { createRingiSourceFreezeReadHandlers } from "@/contexts/ringi/interface/operations/create-ringi-source-freeze-read-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の現在の技術管理権限を読取時にも検査する
export const GET = ringiFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createRingiSourceFreezeReadHandlers(),
)
