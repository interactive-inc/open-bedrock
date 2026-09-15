import { createCompanyCalendarDayPreservationDecisionHandlers } from "@/contexts/company-calendar/interface/operations/create-company-calendar-preservation-decision-handlers"
import { companyCalendarDayFactory } from "@/contexts/company-calendar/interface/request-environment/company-calendar-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 現在の人間の認証とCompanyの承認資格でSystemの判断を記録する
export const POST = companyCalendarDayFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createCompanyCalendarDayPreservationDecisionHandlers("reject"),
)
