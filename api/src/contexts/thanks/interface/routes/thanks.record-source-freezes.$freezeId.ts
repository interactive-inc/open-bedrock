import { thanksFactory } from "@/contexts/thanks/interface/request-environment/thanks-factory"
import { createThanksSourceFreezeReadHandlers } from "@/contexts/thanks/interface/operations/create-thanks-source-freeze-read-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の現在の技術管理権限を読取時にも検査する
export const GET = thanksFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createThanksSourceFreezeReadHandlers(),
)
