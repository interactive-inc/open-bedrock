import { UnexpectedError } from "@/lib/errors"
import { LifeEventRepository } from "@/contexts/life-event/infrastructure/life-event.repository"

import { ApplicationError } from "@/lib/errors"
import { zAppLifeEventList } from "@/lib/app-schemas"
import { factory } from "@/api/http/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/lib/http/to-bounded-int"
import { toHttpException } from "@/lib/http/to-http-exception"
import { verifyBearer } from "@/api/http/verify-bearer"
import { UnauthorizedError } from "@/lib/http/errors"
import { lifeEvents } from "@/contexts/life-event/infrastructure/schema/life-event"
import { count, eq } from "drizzle-orm"

// @authorization owner - 本人のリソースに限定する
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

  const lifeEventRows = await (async () => {
    const command = {
      employeeId: viewer.employeeId,
      limit,
      offset,
    }

    const lifeEventRepository = new LifeEventRepository(c)

    const lifeEvents = await lifeEventRepository.findByEmployeeId({
      employeeId: command.employeeId,
      limit: command.limit,
      offset: command.offset,
    })

    if (lifeEvents instanceof Error) {
      return new UnexpectedError("failed to find life events", { cause: lifeEvents })
    }

    return lifeEvents
  })()

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
