import { antisocialCheckFactory } from "@/contexts/antisocial-check/interface/request-environment/antisocial-check-factory"
import { createAntisocialCheckSourceFreezeReadHandlers } from "@/contexts/antisocial-check/interface/operations/create-antisocial-check-source-freeze-read-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の現在の技術管理権限を読取時にも検査する
export const GET = antisocialCheckFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createAntisocialCheckSourceFreezeReadHandlers(),
)
