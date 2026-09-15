import { createHeadcountPlanPreservationSubmissionHandlers } from "@/contexts/headcount-plan/interface/operations/create-headcount-plan-preservation-submission-handlers"
import { headcountPlanFactory } from "@/contexts/headcount-plan/interface/request-environment/headcount-plan-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 保全権限と原記録の管理資格、本文、Company候補を保存時にも検査する
export const POST = headcountPlanFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createHeadcountPlanPreservationSubmissionHandlers("resubmit"),
)
