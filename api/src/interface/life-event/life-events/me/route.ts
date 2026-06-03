import { ListMyLifeEvents } from "@/application/life-event/list-my-life-events"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { InternalError, UnauthorizedError } from "@/interface/lib/errors"

// GET /life-events/me — 届出者本人のライフイベント届出一覧
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const lifeEvents = await new ListMyLifeEvents(c).run({
    employeeId: viewer.employeeId,
  })

  if (lifeEvents instanceof Error) {
    throw new InternalError("failed to load life events")
  }

  const responseBody = lifeEvents.map((lifeEvent) => ({
    id: lifeEvent.id,
    employee_id: lifeEvent.employeeId,
    event_type: lifeEvent.eventType,
    event_date: lifeEvent.eventDate,
    detail: lifeEvent.detail,
    status: lifeEvent.status,
    created_at: lifeEvent.createdAt,
  }))

  return c.json(responseBody, 200)
})
