import { businessTripFactory } from "@/contexts/business-trip/interface/request-environment/business-trip-factory"
import { createBusinessTripSourceFreezeReadHandlers } from "@/contexts/business-trip/interface/operations/create-business-trip-source-freeze-read-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の現在の技術管理権限を読取時にも検査する
export const GET = businessTripFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createBusinessTripSourceFreezeReadHandlers(),
)
