import { oneOnOneFactory } from "@/contexts/one-on-one/interface/request-environment/one-on-one-factory"
import { createOneOnOneSourceFreezeReadHandlers } from "@/contexts/one-on-one/interface/operations/create-one-on-one-source-freeze-read-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の現在の技術管理権限を読取時にも検査する
export const GET = oneOnOneFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createOneOnOneSourceFreezeReadHandlers(),
)
