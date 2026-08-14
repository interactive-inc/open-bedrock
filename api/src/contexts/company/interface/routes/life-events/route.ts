import { CreateLifeEvent } from "@/contexts/company/application/life-event/create-life-event"
import { ApplicationError } from "@/lib/errors"
import { zAppLifeEvent } from "@/lib/app-schemas"
import { factory } from "@/contexts/company/interface/utils/factory"
import { isoDate, lifeEventTypeSchema } from "@/lib/schemas"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization owner - 本人のリソースに限定する
export const POST = factory.createHandlers(
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

    const lifeEvent = await new CreateLifeEvent(c).run({
      employeeId: viewer.employeeId,
      eventType: json.event_type,
      eventDate: json.event_date,
      detail: json.detail ?? null,
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (lifeEvent instanceof ApplicationError) {
      throw toHttpException(lifeEvent)
    }

    const responseBody = zAppLifeEvent.parse({
      id: lifeEvent.id,
      employee_id: lifeEvent.employeeId,
      event_type: lifeEvent.eventType,
      event_date: lifeEvent.eventDate,
      detail: lifeEvent.detail,
      status: lifeEvent.status,
      created_at: lifeEvent.createdAt,
    })

    return c.json(responseBody, 201)
  },
)
