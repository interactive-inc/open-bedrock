import { createRentalReservationRetirementDecisionHandlers } from "@/contexts/rental/interface/operations/create-rental-retirement-decision-handlers"
import { rentalReservationFactory } from "@/contexts/rental/interface/request-environment/rental-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 現在の人間の認証とCompanyの承認資格でSystemの判断を記録する
export const POST = rentalReservationFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createRentalReservationRetirementDecisionHandlers("approve"),
)
