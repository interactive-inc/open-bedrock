import { CreateCompanyCalendarDay } from "@/contexts/company-calendar/application/calendar/create-company-calendar-day"
import { CompanyCalendarDayRepository } from "@/contexts/company-calendar/infrastructure/repositories/calendar/company-calendar-day.repository"
import { BadRequestError, InternalError, UnauthorizedError } from "@/lib/http/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { verifyBearer } from "@/api/http/verify-bearer"
import { factory } from "@/api/http/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/lib/http/to-bounded-int"
import { zAppCompanyCalendarDay, zAppCompanyCalendarDayList } from "@/lib/app-schemas"
import { ApplicationError } from "@/lib/errors"
import { calendarDayKindSchema, isoDate } from "@/lib/schemas"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization service - session を application service に渡して判定する
/** POST /company-calendar-days — 会社休日・振替出勤日を記録する（calendar:manage） */
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

/** year クエリ（YYYY）を年始〜年末の日付範囲に変換する。未指定・不正は null。 */
function toYearRange(raw: string | undefined): { from: string; to: string } | null {
  if (raw === undefined) {
    return null
  }

  if (/^\d{4}$/.test(raw) === false) {
    return null
  }

  return { from: `${raw}-01-01`, to: `${raw}-12-31` }
}

// @authorization authenticated - ログインしていれば誰でも読める共有データ
/** GET /company-calendar-days?year= — 会社カレンダー一覧（全認証者）。year 未指定は当年を使う。 */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const yearRaw = c.req.query("year")

  const now = c.env.NOW ?? new Date().toISOString()

  const fallbackYear = now.slice(0, 4)

  const range = toYearRange(yearRaw ?? fallbackYear)

  if (range === null) {
    throw new BadRequestError("invalid year")
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

  const repository = new CompanyCalendarDayRepository(c)

  const days = await repository.findByDateRange({
    from: range.from,
    to: range.to,
    limit,
    offset,
  })

  if (days instanceof Error) {
    throw new InternalError("failed to load calendar days")
  }

  const total = await repository.countByDateRange({ from: range.from, to: range.to })

  if (total instanceof Error) {
    throw new InternalError("failed to count calendar days")
  }

  const responseBody = zAppCompanyCalendarDayList.parse({
    data: days.map((day) => ({
      id: day.id,
      calendar_date: day.calendarDate,
      kind: day.kind,
      name: day.name,
      created_at: day.createdAt,
    })),
    total,
  })

  return c.json(responseBody, 200)
})
