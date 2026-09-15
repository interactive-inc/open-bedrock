import { createEmployeeWorkStylePreservationSubmissionHandlers } from "@/contexts/work-style/interface/operations/create-work-style-preservation-submission-handlers"
import { employeeWorkStyleFactory } from "@/contexts/work-style/interface/request-environment/work-style-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 保全権限と原記録の管理資格、本文、Company候補を保存時にも検査する
export const POST = employeeWorkStyleFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createEmployeeWorkStylePreservationSubmissionHandlers("create"),
)
