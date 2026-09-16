import { createShiftPreservationSubmissionHandlers } from "@/contexts/shift/interface/operations/create-shift-preservation-submission-handlers"
import { shiftFactory } from "@/contexts/shift/interface/request-environment/shift-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 保全権限と原記録の管理資格、本文、Company候補を保存時にも検査する
export const POST = shiftFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createShiftPreservationSubmissionHandlers("resubmit"),
)
