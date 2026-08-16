import { AdvanceLifeEvent } from "@/contexts/life-event/application/advance-life-event"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { zAppLifeEvent } from "@/lib/app-schemas"
import { factory } from "@/contexts/company/interface/utils/factory"
import { validateUuidParam } from "@/contexts/company/interface/utils/validate-uuid-param"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"

// @authorization service - session を application service に渡して判定する
/** POST /life-events/:id/approve — 人事がライフイベント届出を承認する */
export const POST = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const updated = await new AdvanceLifeEvent(c).run({
    session: session,
    lifeEventId: validateUuidParam(c.req.param("id"), "life event"),
    action: "approve",
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
