import { createBusinessTripPreservationDecisionHandlers } from "@/contexts/business-trip/interface/operations/create-business-trip-preservation-decision-handlers"
import { businessTripFactory } from "@/contexts/business-trip/interface/request-environment/business-trip-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 現在の人間の認証とCompanyの承認資格でSystemの判断を記録する
export const POST = businessTripFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createBusinessTripPreservationDecisionHandlers("approve"),
)
