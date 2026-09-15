import { createFamilyCareLeavePreservationDecisionHandlers } from "@/contexts/family-care-leave/interface/operations/create-family-care-leave-preservation-decision-handlers"
import { familyCareLeaveFactory } from "@/contexts/family-care-leave/interface/request-environment/family-care-leave-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 現在の人間の認証とCompanyの承認資格でSystemの判断を記録する
export const POST = familyCareLeaveFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createFamilyCareLeavePreservationDecisionHandlers("reject"),
)
