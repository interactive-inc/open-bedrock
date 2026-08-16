import { CompanyCalendarDay } from "@/contexts/company-calendar/domain/calendar/company-calendar-day.entity"
import type { Context } from "@/env"
import { companyCalendarDays } from "@/contexts/company-calendar/infrastructure/schema/company-calendar"
import { isUniqueConstraintError } from "@/lib/d1/is-unique-constraint-error"
import { UniqueConstraintError } from "@/lib/d1/unique-constraint-error"
import { and, asc, count, eq, gte, lte } from "drizzle-orm"

export class CompanyCalendarDayRepository {
  constructor(private readonly c: Context) {}

  /** 指定期間の会社カレンダーを日付の昇順で返す。 */
  async findByDateRange(props: {
    from: string
    to: string
    limit: number
    offset: number
  }): Promise<ReadonlyArray<CompanyCalendarDay> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(companyCalendarDays)
        .where(
          and(
            gte(companyCalendarDays.calendarDate, props.from),
            lte(companyCalendarDays.calendarDate, props.to),
          ),
        )
        .orderBy(asc(companyCalendarDays.calendarDate))
        .limit(props.limit)
        .offset(props.offset)

      return rows.map((row) => CompanyCalendarDay.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load company_calendar_days")
    }
  }

  async countByDateRange(props: { from: string; to: string }): Promise<number | Error> {
    try {
      const rows = await this.c.var.database
        .select({ total: count() })
        .from(companyCalendarDays)
        .where(
          and(
            gte(companyCalendarDays.calendarDate, props.from),
            lte(companyCalendarDays.calendarDate, props.to),
          ),
        )

      return rows.at(0)?.total ?? 0
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to count company_calendar_days")
    }
  }

  async findById(id: number): Promise<CompanyCalendarDay | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(companyCalendarDays)
        .where(eq(companyCalendarDays.id, id))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : CompanyCalendarDay.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load company_calendar_day")
    }
  }

  async create(day: CompanyCalendarDay): Promise<CompanyCalendarDay | Error> {
    try {
      const rows = await this.c.var.database
        .insert(companyCalendarDays)
        .values({
          calendarDate: day.calendarDate,
          kind: day.kind,
          name: day.name,
          createdAt: day.createdAt,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined
        ? new Error("failed to create company_calendar_day")
        : CompanyCalendarDay.fromRow(row)
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return new UniqueConstraintError("calendar date already exists", { cause: error })
      }

      return error instanceof Error ? error : new Error("failed to create company_calendar_day")
    }
  }

  async delete(id: number): Promise<null | Error> {
    try {
      await this.c.var.database.delete(companyCalendarDays).where(eq(companyCalendarDays.id, id))

      return null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete company_calendar_day")
    }
  }
}
