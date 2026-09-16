import { performanceReviewFactory } from "@/contexts/performance-review/interface/request-environment/performance-review-factory"
import { createPerformanceReviewSourceFreezeHandlers } from "@/contexts/performance-review/interface/operations/create-performance-review-source-freeze-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の技術管理権限と再認証を保存時にも検査する
export const POST = performanceReviewFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createPerformanceReviewSourceFreezeHandlers("create"),
)
