import { createPerformanceReviewPreservationSubmissionHandlers } from "@/contexts/performance-review/interface/operations/create-performance-review-preservation-submission-handlers"
import { performanceReviewFactory } from "@/contexts/performance-review/interface/request-environment/performance-review-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 保全権限と原記録の管理資格、本文、Company候補を保存時にも検査する
export const POST = performanceReviewFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createPerformanceReviewPreservationSubmissionHandlers("create"),
)
