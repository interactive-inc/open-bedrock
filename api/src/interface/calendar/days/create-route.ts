import { CreateCompanyCalendarDay } from "@/application/calendar/create-company-calendar-day"
import { factory } from "@/lib/factory"
import { ApplicationError } from "@/lib/errors"
import { zAppCompanyCalendarDay } from "@/lib/app-schemas"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { calendarDayKindSchema, isoDate } from "@/lib/schemas"
import { zValidator } from "@hono/zod-validator"
import { UnauthorizedError } from "@/interface/lib/errors"
import { z } from "zod"

// POST /calendar/days — 会社休日・振替出勤日を記録する（calendar:manage）
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      calendar_date: isoDate,
      kind: calendarDayKindSchema,
      name: z.string().max(200).nullable().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const day = await new CreateCompanyCalendarDay(c).run({
      session,
      calendarDate: json.calendar_date,
      kind: json.kind,
      name: json.name ?? null,
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (day instanceof ApplicationError) {
      throw toHttpException(day)
    }

    const responseBody = zAppCompanyCalendarDay.parse({
      id: day.id,
      calendar_date: day.calendarDate,
      kind: day.kind,
      name: day.name,
      created_at: day.createdAt,
    })

    return c.json(responseBody, 201)
  },
)
