import { createCompanyCalendarDayPreservationSubmissionHandlers } from "@/contexts/company-calendar/interface/operations/create-company-calendar-preservation-submission-handlers"
import { companyCalendarDayFactory } from "@/contexts/company-calendar/interface/request-environment/company-calendar-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 保全権限と原記録の管理資格、本文、Company候補を保存時にも検査する
export const POST = companyCalendarDayFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createCompanyCalendarDayPreservationSubmissionHandlers("create"),
)
