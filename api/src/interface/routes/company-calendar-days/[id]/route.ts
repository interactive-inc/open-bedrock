import { DeleteCompanyCalendarDay } from "@/application/calendar/delete-company-calendar-day"
import { factory } from "@/interface/utils/factory"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { validateIntParam } from "@/interface/utils/validate-int-param"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { UnauthorizedError } from "@/interface/lib/errors"

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
