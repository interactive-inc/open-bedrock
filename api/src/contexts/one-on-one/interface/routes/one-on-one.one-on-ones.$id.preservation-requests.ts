import { createOneOnOnePreservationSubmissionHandlers } from "@/contexts/one-on-one/interface/operations/create-one-on-one-preservation-submission-handlers"
import { oneOnOneFactory } from "@/contexts/one-on-one/interface/request-environment/one-on-one-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 保全権限と原記録の管理資格、本文、Company候補を保存時にも検査する
export const POST = oneOnOneFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createOneOnOnePreservationSubmissionHandlers("create"),
)
