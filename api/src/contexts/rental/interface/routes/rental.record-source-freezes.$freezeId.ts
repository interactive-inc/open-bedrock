import { rentalReservationFactory } from "@/contexts/rental/interface/request-environment/rental-factory"
import { createRentalReservationSourceFreezeReadHandlers } from "@/contexts/rental/interface/operations/create-rental-source-freeze-read-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の現在の技術管理権限を読取時にも検査する
export const GET = rentalReservationFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createRentalReservationSourceFreezeReadHandlers(),
)
