import { compensationChangeFactory } from "@/contexts/compensation-change/interface/request-environment/compensation-change-factory"
import { createCompensationChangeSourceFreezeReadHandlers } from "@/contexts/compensation-change/interface/operations/create-compensation-change-source-freeze-read-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の現在の技術管理権限を読取時にも検査する
export const GET = compensationChangeFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createCompensationChangeSourceFreezeReadHandlers(),
)
