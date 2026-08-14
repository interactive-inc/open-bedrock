import { CompanyCalendarDayRepository } from "@/infrastructure/calendar/company-calendar-day-repository"
import { factory } from "@/interface/utils/factory"
import { zAppCompanyCalendarDayList } from "@/lib/app-schemas"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/utils/to-bounded-int"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { BadRequestError, InternalError, UnauthorizedError } from "@/interface/lib/errors"

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
