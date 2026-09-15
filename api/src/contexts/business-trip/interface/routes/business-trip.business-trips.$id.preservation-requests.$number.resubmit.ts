import { createBusinessTripPreservationSubmissionHandlers } from "@/contexts/business-trip/interface/operations/create-business-trip-preservation-submission-handlers"
import { businessTripFactory } from "@/contexts/business-trip/interface/request-environment/business-trip-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 保全権限と原記録の管理資格、本文、Company候補を保存時にも検査する
export const POST = businessTripFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createBusinessTripPreservationSubmissionHandlers("resubmit"),
)
