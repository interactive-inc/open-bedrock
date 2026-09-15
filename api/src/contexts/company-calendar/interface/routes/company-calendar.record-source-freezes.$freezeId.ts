import { companyCalendarDayFactory } from "@/contexts/company-calendar/interface/request-environment/company-calendar-factory"
import { createCompanyCalendarDaySourceFreezeReadHandlers } from "@/contexts/company-calendar/interface/operations/create-company-calendar-source-freeze-read-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の現在の技術管理権限を読取時にも検査する
export const GET = companyCalendarDayFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createCompanyCalendarDaySourceFreezeReadHandlers(),
)
