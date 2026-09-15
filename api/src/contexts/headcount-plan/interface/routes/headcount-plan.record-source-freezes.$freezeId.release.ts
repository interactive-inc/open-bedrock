import { headcountPlanFactory } from "@/contexts/headcount-plan/interface/request-environment/headcount-plan-factory"
import { createHeadcountPlanSourceFreezeHandlers } from "@/contexts/headcount-plan/interface/operations/create-headcount-plan-source-freeze-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の技術管理権限と再認証を解除時にも検査する
export const POST = headcountPlanFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createHeadcountPlanSourceFreezeHandlers("release"),
)
