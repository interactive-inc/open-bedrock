import { resignationFactory } from "@/contexts/resignation/interface/request-environment/resignation-factory"
import { createResignationSourceFreezeReadHandlers } from "@/contexts/resignation/interface/operations/create-resignation-source-freeze-read-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の現在の技術管理権限を読取時にも検査する
export const GET = resignationFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createResignationSourceFreezeReadHandlers(),
)
