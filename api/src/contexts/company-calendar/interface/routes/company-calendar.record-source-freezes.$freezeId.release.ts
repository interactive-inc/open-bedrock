import { companyCalendarDayFactory } from "@/contexts/company-calendar/interface/request-environment/company-calendar-factory"
import { createCompanyCalendarDaySourceFreezeHandlers } from "@/contexts/company-calendar/interface/operations/create-company-calendar-source-freeze-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の技術管理権限と再認証を解除時にも検査する
export const POST = companyCalendarDayFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createCompanyCalendarDaySourceFreezeHandlers("release"),
)
