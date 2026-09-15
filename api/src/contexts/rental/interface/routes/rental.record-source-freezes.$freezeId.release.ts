import { rentalReservationFactory } from "@/contexts/rental/interface/request-environment/rental-factory"
import { createRentalReservationSourceFreezeHandlers } from "@/contexts/rental/interface/operations/create-rental-source-freeze-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の技術管理権限と再認証を解除時にも検査する
export const POST = rentalReservationFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createRentalReservationSourceFreezeHandlers("release"),
)
