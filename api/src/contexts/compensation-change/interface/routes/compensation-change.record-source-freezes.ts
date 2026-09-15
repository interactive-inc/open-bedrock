import { compensationChangeFactory } from "@/contexts/compensation-change/interface/request-environment/compensation-change-factory"
import { createCompensationChangeSourceFreezeHandlers } from "@/contexts/compensation-change/interface/operations/create-compensation-change-source-freeze-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の技術管理権限と再認証を保存時にも検査する
export const POST = compensationChangeFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createCompensationChangeSourceFreezeHandlers("create"),
)
