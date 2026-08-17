import { AdvanceLifeEvent } from "@/contexts/life-event/application/advance-life-event"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/contexts/company-compatibility/interface/lib/to-http-exception"
import { UnauthorizedError } from "@/contexts/company-compatibility/interface/lib/errors"
import { zAppLifeEvent } from "@/lib/app-schemas"
import { factory } from "@/contexts/company-compatibility/interface/utils/factory"
import { validateUuidParam } from "@/contexts/company-compatibility/interface/utils/validate-uuid-param"
import { verifyBearer } from "@/contexts/company-compatibility/interface/middlewares/verify-bearer"

// @authorization service - session を application service に渡して判定する
/** POST /life-events/:id/reject — 人事がライフイベント届出を却下する */
export const POST = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const updated = await new AdvanceLifeEvent(c).run({
    session: session,
    lifeEventId: validateUuidParam(c.req.param("id"), "life event"),
    action: "reject",
  })

  if (updated instanceof ApplicationError) {
    throw toHttpException(updated)
  }

  const responseBody = zAppLifeEvent.parse({
    id: updated.id,
    employee_id: updated.employeeId,
    event_type: updated.eventType,
    event_date: updated.eventDate,
    detail: updated.detail,
    status: updated.status,
    created_at: updated.createdAt,
  })

  return c.json(responseBody, 200)
})
