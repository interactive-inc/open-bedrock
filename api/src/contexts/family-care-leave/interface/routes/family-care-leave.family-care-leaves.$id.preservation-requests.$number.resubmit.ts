import { createFamilyCareLeavePreservationSubmissionHandlers } from "@/contexts/family-care-leave/interface/operations/create-family-care-leave-preservation-submission-handlers"
import { familyCareLeaveFactory } from "@/contexts/family-care-leave/interface/request-environment/family-care-leave-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 保全権限と原記録の管理資格、本文、Company候補を保存時にも検査する
export const POST = familyCareLeaveFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createFamilyCareLeavePreservationSubmissionHandlers("resubmit"),
)
