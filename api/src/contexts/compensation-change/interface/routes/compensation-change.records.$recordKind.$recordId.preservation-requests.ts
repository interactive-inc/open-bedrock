import { createCompensationChangePreservationSubmissionHandlers } from "@/contexts/compensation-change/interface/operations/create-compensation-change-preservation-submission-handlers"
import { compensationChangeFactory } from "@/contexts/compensation-change/interface/request-environment/compensation-change-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 保全権限と原記録の管理資格、本文、Company候補を保存時にも検査する
export const POST = compensationChangeFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createCompensationChangePreservationSubmissionHandlers("create"),
)
