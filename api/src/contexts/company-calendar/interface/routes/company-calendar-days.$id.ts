import { DeleteCompanyCalendarDay } from "@/contexts/company-calendar/application/calendar/delete-company-calendar-day"
import { factory } from "@/contexts/company-compatibility/interface/utils/factory"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/contexts/company-compatibility/interface/lib/to-http-exception"
import { validateIntParam } from "@/contexts/company-compatibility/interface/utils/validate-int-param"
import { verifyBearer } from "@/contexts/company-compatibility/interface/middlewares/verify-bearer"
import { UnauthorizedError } from "@/contexts/company-compatibility/interface/lib/errors"

// @authorization service - session を application service に渡して判定する
/** DELETE /company-calendar-days/:id — 会社カレンダーから 1 日を削除（calendar:manage） */
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const result = await new DeleteCompanyCalendarDay(c).run({
    session,
    id: validateIntParam(c.req.param("id") ?? "", "calendar_day"),
  })

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  return c.body(null, 204)
})
