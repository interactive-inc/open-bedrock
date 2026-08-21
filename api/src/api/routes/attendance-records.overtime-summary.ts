import { countBusinessDays } from "@/contexts/company-calendar/domain/calendar/count-business-days"
import { toOvertimeEntries } from "@/contexts/attendance/domain/to-overtime-entries"
import { toMonthRange } from "@/contexts/attendance/interface/http/attendance-records/to-month-range"
import { listReportEmployeeIds } from "@/contexts/company/interface/utils/list-report-employee-ids"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { factory } from "@/contexts/company/interface/utils/factory"
import { zAppOvertimeSummary } from "@/lib/app-schemas"
import { yearMonth } from "@/lib/schemas"
import { readOvertimeSummaryInput } from "@/api/http/attendance-records/overtime-summary/read-overtime-summary-input"
import {
  BadRequestError,
  ForbiddenError,
  InternalError,
  UnauthorizedError,
} from "@/contexts/company/interface/lib/errors"

/** 1 日の所定労働時間の目安（8 時間）。時間外の参考値算出に使う。法定判定ではない。 */
const DAILY_REGULAR_MINUTES = 480

const OVERTIME_NOTE =
  "1 日 8 時間×営業日を超えた労働時間の合計です。36 協定などの法定判定ではなく、あくまで参考の集計値です。"

// @authorization permission - 権限キーで判定する
/**
 * GET /attendance-records/overtime-summary?month=&scope= — 時間外の参考集計。
 * scope=reports は attendance:read:reports、scope=all は attendance:read:all を要求する（GET /attendance-records と同じ判定）。
 */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const now = c.env.NOW ?? new Date().toISOString()

  const monthRaw = c.req.query("month") ?? now.slice(0, 7)

  const parsedMonth = yearMonth.safeParse(monthRaw)

  if (parsedMonth.success === false) {
    throw new BadRequestError("invalid month")
  }

  const range = toMonthRange(parsedMonth.data)

  const scope = c.req.query("scope") ?? null

  let employeeIds: ReadonlyArray<number> | null

  if (scope === "all") {
    if (session.hasPermission("attendance:read:all") === false) {
      throw new ForbiddenError()
    }
    employeeIds = null
  } else if (scope === "reports") {
    if (session.hasPermission("attendance:read:reports") === false) {
      throw new ForbiddenError()
    }

    const reportEmployeeIds = await listReportEmployeeIds({
      c,
      viewerEmployeeId: session.employeeId,
    })

    if (reportEmployeeIds instanceof Error) {
      throw new InternalError("failed to resolve report employees")
    }

    if (reportEmployeeIds.length === 0) {
      const emptyBody = zAppOvertimeSummary.parse({
        month: range.month,
        business_days: 0,
        daily_regular_minutes: DAILY_REGULAR_MINUTES,
        entries: [],
        note: OVERTIME_NOTE,
      })

      return c.json(emptyBody, 200)
    }

    employeeIds = reportEmployeeIds
  } else {
    // scope 未指定は本人のみ集計する。
    employeeIds = [session.employeeId]
  }

  const { rows, overrideRows } = await readOvertimeSummaryInput(c, {
    from: range.from,
    to: range.to,
    employeeIds,
  })

  const businessDays = countBusinessDays({
    month: range.month,
    overrides: overrideRows.map((row) => ({ calendarDate: row.calendarDate, kind: row.kind })),
  })

  const entries = toOvertimeEntries({
    rows,
    businessDays,
    dailyRegularMinutes: DAILY_REGULAR_MINUTES,
  })

  const responseBody = zAppOvertimeSummary.parse({
    month: range.month,
    business_days: businessDays,
    daily_regular_minutes: DAILY_REGULAR_MINUTES,
    entries: entries.map((entry) => ({
      employee_id: entry.employeeId,
      work_days: entry.workDays,
      total_work_minutes: entry.totalWorkMinutes,
      overtime_minutes: entry.overtimeMinutes,
    })),
    note: OVERTIME_NOTE,
  })

  return c.json(responseBody, 200)
})
