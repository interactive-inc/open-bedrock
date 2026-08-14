import { CancelLifeEvent } from "@/contexts/company/application/life-event/cancel-life-event"
import { GetLifeEvent } from "@/contexts/company/application/life-event/get-life-event"
import { UpdateLifeEvent } from "@/contexts/company/application/life-event/update-life-event"
import type { LifeEvent } from "@/contexts/company/domain/life-event/life-event.entity"
import { ApplicationError } from "@/lib/errors"
import { zAppLifeEvent } from "@/lib/app-schemas"
import { factory } from "@/contexts/company/interface/utils/factory"
import { isoDate, lifeEventTypeSchema } from "@/lib/schemas"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { validateUuidParam } from "@/contexts/company/interface/utils/validate-uuid-param"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

/** ライフイベント届出をレスポンス用の snake_case に整形する。 */
function toResponseBody(lifeEvent: LifeEvent) {
  return {
    id: lifeEvent.id,
    employee_id: lifeEvent.employeeId,
    event_type: lifeEvent.eventType,
    event_date: lifeEvent.eventDate,
    detail: lifeEvent.detail,
    status: lifeEvent.status,
    created_at: lifeEvent.createdAt,
  }
}

// @authorization owner - 本人のリソースに限定する
/** GET /life-events/:id — ライフイベント届出の詳細（本人のみ） */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const lifeEvent = await new GetLifeEvent(c).run({
    lifeEventId: validateUuidParam(c.req.param("id"), "life event"),
    employeeId: viewer.employeeId,
  })

  if (lifeEvent instanceof ApplicationError) {
    throw toHttpException(lifeEvent)
  }

  const responseBody = zAppLifeEvent.parse(toResponseBody(lifeEvent))

  return c.json(responseBody, 200)
})

// @authorization owner - 本人のリソースに限定する
/** PUT /life-events/:id — ライフイベント届出の内容を変更（本人のみ） */
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      event_type: lifeEventTypeSchema,
      event_date: isoDate,
      detail: z.string().max(3_000).nullable().optional(),
    }),
  ),
  async (c) => {
    const viewer = c.var.session

    if (viewer === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const lifeEvent = await new UpdateLifeEvent(c).run({
      lifeEventId: validateUuidParam(c.req.param("id"), "life event"),
      employeeId: viewer.employeeId,
      eventType: json.event_type,
      eventDate: json.event_date,
      detail: json.detail ?? null,
    })

    if (lifeEvent instanceof ApplicationError) {
      throw toHttpException(lifeEvent)
    }

    const responseBody = zAppLifeEvent.parse(toResponseBody(lifeEvent))

    return c.json(responseBody, 200)
  },
)

// @authorization owner - 本人のリソースに限定する
/** DELETE /life-events/:id — ライフイベント届出を取消（本人のみ） */
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const result = await new CancelLifeEvent(c).run({
    lifeEventId: validateUuidParam(c.req.param("id"), "life event"),
    employeeId: viewer.employeeId,
  })

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  return c.body(null, 204)
})
