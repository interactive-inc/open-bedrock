import { ListMyLifeEvents } from "@/application/life-event/list-my-life-events"
import { factory } from "@/lib/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/shared/to-bounded-int"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { InternalError, UnauthorizedError } from "@/interface/lib/errors"
import { lifeEvents } from "@/schema"
import { count, eq } from "drizzle-orm"

// GET /life-events/me — 届出者本人のライフイベント届出一覧
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const limit = toBoundedInt({
    raw: c.req.query("limit"),
    fallback: DEFAULT_LIST_LIMIT,
    min: 1,
    max: MAX_LIST_LIMIT,
  })

  const offset = toBoundedInt({
    raw: c.req.query("offset"),
    fallback: 0,
    min: 0,
    max: MAX_LIST_OFFSET,
  })

  const lifeEventRows = await new ListMyLifeEvents(c).run({
    employeeId: viewer.employeeId,
    limit,
    offset,
  })

  if (lifeEventRows instanceof Error) {
    throw new InternalError("failed to load life events")
  }

  const totalRows = await c.var.database
    .select({ total: count() })
    .from(lifeEvents)
    .where(eq(lifeEvents.employeeId, viewer.employeeId))

  const responseBody = lifeEventRows.map((lifeEvent) => ({
    id: lifeEvent.id,
    employee_id: lifeEvent.employeeId,
    event_type: lifeEvent.eventType,
    event_date: lifeEvent.eventDate,
    detail: lifeEvent.detail,
    status: lifeEvent.status,
    created_at: lifeEvent.createdAt,
  }))

  return c.json({ data: responseBody, total: totalRows.at(0)?.total ?? 0 }, 200)
})
