import { ListMyLifeEvents } from "@/application/life-event/list-my-life-events"
import { ApplicationError } from "@/lib/errors"
import { zAppLifeEventList } from "@/lib/app-schemas"
import { factory } from "@/lib/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/utils/to-bounded-int"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { verifyBearer } from "@/interface/middleware/verify-bearer"
import { UnauthorizedError } from "@/interface/lib/errors"
import { lifeEvents } from "@/schema"
import { count, eq } from "drizzle-orm"

/** GET /life-events/me — 届出者本人のライフイベント届出一覧 */
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

  if (lifeEventRows instanceof ApplicationError) {
    throw toHttpException(lifeEventRows)
  }

  const totalRows = await c.var.database
    .select({ total: count() })
    .from(lifeEvents)
    .where(eq(lifeEvents.employeeId, viewer.employeeId))

  const responseBody = zAppLifeEventList.parse({
    data: lifeEventRows.map((lifeEvent) => ({
      id: lifeEvent.id,
      employee_id: lifeEvent.employeeId,
      event_type: lifeEvent.eventType,
      event_date: lifeEvent.eventDate,
      detail: lifeEvent.detail,
      status: lifeEvent.status,
      created_at: lifeEvent.createdAt,
    })),
    total: totalRows.at(0)?.total ?? 0,
  })

  return c.json(responseBody, 200)
})
