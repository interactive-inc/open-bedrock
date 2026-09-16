import { regulationFactory } from "@/contexts/regulation/interface/request-environment/regulation-factory"
import { createRegulationSourceFreezeReadHandlers } from "@/contexts/regulation/interface/operations/create-regulation-source-freeze-read-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の現在の技術管理権限を読取時にも検査する
export const GET = regulationFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createRegulationSourceFreezeReadHandlers(),
)
