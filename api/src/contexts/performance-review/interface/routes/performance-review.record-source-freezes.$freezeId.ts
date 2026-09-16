import { performanceReviewFactory } from "@/contexts/performance-review/interface/request-environment/performance-review-factory"
import { createPerformanceReviewSourceFreezeReadHandlers } from "@/contexts/performance-review/interface/operations/create-performance-review-source-freeze-read-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の現在の技術管理権限を読取時にも検査する
export const GET = performanceReviewFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createPerformanceReviewSourceFreezeReadHandlers(),
)
