import { createRentalReservationPreservationSubmissionHandlers } from "@/contexts/rental/interface/operations/create-rental-preservation-submission-handlers"
import { rentalReservationFactory } from "@/contexts/rental/interface/request-environment/rental-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 保全権限と原記録の管理資格、本文、Company候補を保存時にも検査する
export const POST = rentalReservationFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createRentalReservationPreservationSubmissionHandlers("resubmit"),
)
