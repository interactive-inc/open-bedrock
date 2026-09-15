import { businessTripFactory } from "@/contexts/business-trip/interface/request-environment/business-trip-factory"
import { createBusinessTripSourceFreezeHandlers } from "@/contexts/business-trip/interface/operations/create-business-trip-source-freeze-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の技術管理権限と再認証を保存時にも検査する
export const POST = businessTripFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createBusinessTripSourceFreezeHandlers("create"),
)
