import { CancelLifeEvent } from "@/application/life-event/cancel-life-event"
import { GetLifeEvent } from "@/application/life-event/get-life-event"
import { UpdateLifeEvent } from "@/application/life-event/update-life-event"
import type { LifeEvent } from "@/domain/life-event/life-event"
import { factory } from "@/lib/factory"
import { isoDate } from "@/lib/schemas"
import { toResourceId } from "@/interface/shared/to-resource-id"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// ライフイベント届出をレスポンス用の snake_case に整形する。
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

// GET /life-events/:id — ライフイベント届出の詳細（本人のみ）
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const id = toResourceId(c.req.param("id") ?? "")

  if (id === null) {
    throw new BadRequestError("invalid id")
  }

  const lifeEvent = await new GetLifeEvent(c).run({
    lifeEventId: id,
    employeeId: viewer.employeeId,
  })

  if (lifeEvent instanceof Error) {
    throw new InternalError("failed to load life event")
  }

  if ("reason" in lifeEvent) {
    if (lifeEvent.reason === "life_event_not_found") {
      throw new NotFoundError("life event not found")
    }

    throw new ForbiddenError("not the applicant")
  }

  return c.json(toResponseBody(lifeEvent), 200)
})

// PUT /life-events/:id — ライフイベント届出の内容を変更（本人のみ）
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      event_type: z.string().min(1).max(200),
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

    const id = toResourceId(c.req.param("id") ?? "")

    if (id === null) {
      throw new BadRequestError("invalid id")
    }

    const lifeEvent = await new UpdateLifeEvent(c).run({
      lifeEventId: id,
      employeeId: viewer.employeeId,
      eventType: json.event_type,
      eventDate: json.event_date,
      detail: json.detail ?? null,
    })

    if (lifeEvent instanceof Error) {
      throw new InternalError("failed to update life event")
    }

    if ("reason" in lifeEvent) {
      if (lifeEvent.reason === "life_event_not_found") {
        throw new NotFoundError("life event not found")
      }

      if (lifeEvent.reason === "not_modifiable") {
        throw new ConflictError("not modifiable")
      }

      throw new ForbiddenError("not the applicant")
    }

    return c.json(toResponseBody(lifeEvent), 200)
  },
)

// DELETE /life-events/:id — ライフイベント届出を取消（本人のみ）
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const id = toResourceId(c.req.param("id") ?? "")

  if (id === null) {
    throw new BadRequestError("invalid id")
  }

  const result = await new CancelLifeEvent(c).run({
    lifeEventId: id,
    employeeId: viewer.employeeId,
  })

  if (result instanceof Error) {
    throw new InternalError("failed to cancel life event")
  }

  if (result.reason === "life_event_not_found") {
    throw new NotFoundError("life event not found")
  }

  if (result.reason === "not_applicant") {
    throw new ForbiddenError("not the applicant")
  }

  if (result.reason === "not_modifiable") {
    throw new ConflictError("not modifiable")
  }

  return c.body(null, 204)
})
