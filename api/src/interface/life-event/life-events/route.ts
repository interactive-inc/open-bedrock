import { CreateLifeEvent } from "@/application/life-event/create-life-event"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { InternalError, UnauthorizedError } from "@/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      event_type: z.string().min(1),
      event_date: z.string().min(1),
      detail: z.string().nullable().optional(),
    }),
  ),
  async (c) => {
    const viewer = c.var.session

    if (viewer === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const lifeEvent = await new CreateLifeEvent(c).run({
      employeeId: viewer.employeeId,
      eventType: json.event_type,
      eventDate: json.event_date,
      detail: json.detail ?? null,
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (lifeEvent instanceof Error) {
      throw new InternalError("failed to create life event")
    }

    const responseBody = {
      id: lifeEvent.id,
      employee_id: lifeEvent.employeeId,
      event_type: lifeEvent.eventType,
      event_date: lifeEvent.eventDate,
      detail: lifeEvent.detail,
      status: lifeEvent.status,
      created_at: lifeEvent.createdAt,
    }

    return c.json(responseBody, 201)
  },
)
