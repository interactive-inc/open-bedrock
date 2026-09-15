import { headcountPlanFactory } from "@/contexts/headcount-plan/interface/request-environment/headcount-plan-factory"
import { createHeadcountPlanSourceFreezeReadHandlers } from "@/contexts/headcount-plan/interface/operations/create-headcount-plan-source-freeze-read-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の現在の技術管理権限を読取時にも検査する
export const GET = headcountPlanFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createHeadcountPlanSourceFreezeReadHandlers(),
)
