import { createPerformanceReviewPreservationDecisionHandlers } from "@/contexts/performance-review/interface/operations/create-performance-review-preservation-decision-handlers"
import { performanceReviewFactory } from "@/contexts/performance-review/interface/request-environment/performance-review-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 現在の人間の認証とCompanyの承認資格でSystemの判断を記録する
export const POST = performanceReviewFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createPerformanceReviewPreservationDecisionHandlers("reject"),
)
