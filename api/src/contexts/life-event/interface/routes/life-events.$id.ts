import { ConflictError } from "@/lib/errors"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import { LifeEventRepository } from "@/contexts/life-event/infrastructure/life-event.repository"
import { UpdateLifeEvent } from "@/contexts/life-event/application/update-life-event"
import type { LifeEvent } from "@/contexts/life-event/domain/entities/life-event.entity"
import { ApplicationError } from "@/lib/errors"
import { zAppLifeEvent } from "@/lib/app-schemas"
import { factory } from "@/api/http/factory"
import { isoDate, lifeEventTypeSchema } from "@/lib/schemas"
import { toHttpException } from "@/lib/http/to-http-exception"
import { verifyBearer } from "@/api/http/verify-bearer"
import { UnauthorizedError } from "@/lib/http/errors"
import { validateUuidParam } from "@/lib/http/validate-uuid-param"
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

  const lifeEvent = await (async () => {
    const command = {
      lifeEventId: validateUuidParam(c.req.param("id"), "life event"),
      employeeId: viewer.employeeId,
    }

    const lifeEventRepository = new LifeEventRepository(c)

    const lifeEvent = await lifeEventRepository.findById(command.lifeEventId)

    if (lifeEvent instanceof Error) {
      return new UnexpectedError("failed to find life event", { cause: lifeEvent })
    }

    if (lifeEvent === null) {
      return new NotFoundError("life event not found", "life_event_not_found")
    }

    if (lifeEvent.employeeId !== command.employeeId) {
      return new ForbiddenError("not the applicant", "not_applicant")
    }

    return lifeEvent
  })()

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

  const result = await (async () => {
    const command = {
      lifeEventId: validateUuidParam(c.req.param("id"), "life event"),
      employeeId: viewer.employeeId,
    }

    const lifeEventRepository = new LifeEventRepository(c)

    const current = await lifeEventRepository.findById(command.lifeEventId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find life event", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("life event not found", "life_event_not_found")
    }

    if (current.employeeId !== command.employeeId) {
      return new ForbiddenError("not the applicant", "not_applicant")
    }

    if (!current.isModifiable) {
      return new ConflictError("life event is not modifiable", "not_modifiable")
    }

    const deleted = await lifeEventRepository.delete(command.lifeEventId)

    if (deleted instanceof Error) {
      return new UnexpectedError("failed to delete life event", { cause: deleted })
    }

    if (deleted === null) {
      return new ConflictError("life event is not modifiable", "not_modifiable")
    }

    return { reason: "cancelled" }
  })()

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  return c.body(null, 204)
})
