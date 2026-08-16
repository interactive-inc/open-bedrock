import type { Context } from "@/env"
import { UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { toManagementDashboardRanges } from "@/contexts/company/application/dashboard/to-management-dashboard-ranges"
import type { AppManagementDashboard } from "@/lib/app-schemas"
import {
  attendanceRecords,
  employeeEvents,
  employees,
  expenses,
  goals,
  leaveRequests,
  reviewCycles,
} from "@/schema"
import { systemCases } from "@system/infrastructure/schema/system-workflow"
import { and, count, eq, gte, like, sql } from "drizzle-orm"

/**
 * 経営ダッシュボードの横断集計。予測・計算は持たず、在籍・入退社・勤怠・休暇・経費・評価・
 * 目標・申請の件数を素直に数えるだけ。基準時刻は c.env.NOW(テスト固定)か実時計。
 */
export class GetManagementDashboard {
  constructor(private readonly c: Context) {}

  async run(): Promise<AppManagementDashboard | ApplicationError> {
    const nowIso = this.c.env.NOW ?? new Date().toISOString()

    const ranges = toManagementDashboardRanges(nowIso)

    const monthLike = `${ranges.monthPrefix}%`

    try {
      const database = this.c.var.database

      const [
        employeeRows,
        joinRows,
        retireRows,
        attendanceRows,
        leaveMonthRows,
        leavePendingRows,
        expenseMonthRows,
        expensePendingRows,
        openReviewCycleRows,
        pendingApplicationRows,
      ] = await database.batch([
        database.select({ total: count() }).from(employees).where(eq(employees.status, "active")),
        database
          .select({ total: count() })
          .from(employeeEvents)
          .where(
            and(eq(employeeEvents.kind, "join"), gte(employeeEvents.effectiveDate, ranges.since)),
          ),
        database
          .select({ total: count() })
          .from(employeeEvents)
          .where(
            and(eq(employeeEvents.kind, "retire"), gte(employeeEvents.effectiveDate, ranges.since)),
          ),
        database
          .select({ total: count() })
          .from(attendanceRecords)
          .where(like(attendanceRecords.workDate, monthLike)),
        database
          .select({ total: count() })
          .from(leaveRequests)
          .where(like(leaveRequests.createdAt, monthLike)),
        database
          .select({ total: count() })
          .from(leaveRequests)
          .where(eq(leaveRequests.status, "pending")),
        database
          .select({ total: count() })
          .from(expenses)
          .where(like(expenses.createdAt, monthLike)),
        database.select({ total: count() }).from(expenses).where(eq(expenses.status, "pending")),
        database
          .select({ total: count() })
          .from(reviewCycles)
          .where(eq(reviewCycles.status, "open")),
        database
          .select({ total: count() })
          .from(systemCases)
          .where(eq(systemCases.status, "pending")),
      ])

      const departmentRows = await database
        .select({
          department_name: employees.deptName,
          headcount: count(),
        })
        .from(employees)
        .where(eq(employees.status, "active"))
        .groupBy(employees.deptName)
        .orderBy(sql`count(*) desc`)

      const goalRows = await database
        .select({
          period: goals.period,
          status: goals.status,
          total: count(),
        })
        .from(goals)
        .groupBy(goals.period, goals.status)

      return {
        employee_count: employeeRows.at(0)?.total ?? 0,
        department_headcounts: departmentRows.map((row) => ({
          department_name: row.department_name,
          headcount: row.headcount,
        })),
        recent_join_count: joinRows.at(0)?.total ?? 0,
        recent_retire_count: retireRows.at(0)?.total ?? 0,
        attendance_record_count: attendanceRows.at(0)?.total ?? 0,
        leave_request_count: leaveMonthRows.at(0)?.total ?? 0,
        leave_pending_count: leavePendingRows.at(0)?.total ?? 0,
        expense_count: expenseMonthRows.at(0)?.total ?? 0,
        expense_pending_count: expensePendingRows.at(0)?.total ?? 0,
        open_review_cycle_count: openReviewCycleRows.at(0)?.total ?? 0,
        pending_application_count: pendingApplicationRows.at(0)?.total ?? 0,
        goal_done_rates: this.toGoalDoneRates(goalRows),
      }
    } catch (error) {
      return new UnexpectedError("failed to aggregate management dashboard", { cause: error })
    }
  }

  /** period ごとに done 件数と総数から done 率(0-1)を出す。 */
  private toGoalDoneRates(
    rows: ReadonlyArray<{ period: string; status: string; total: number }>,
  ): AppManagementDashboard["goal_done_rates"] {
    const totalsByPeriod = new Map<string, { total: number; done: number }>()

    for (const row of rows) {
      const entry = totalsByPeriod.get(row.period) ?? { total: 0, done: 0 }

      const done = row.status === "done" ? entry.done + row.total : entry.done

      totalsByPeriod.set(row.period, { total: entry.total + row.total, done })
    }

    const rates: Array<{ period: string; total: number; done: number; done_rate: number }> = []

    for (const entry of totalsByPeriod.entries()) {
      const period = entry[0]

      const value = entry[1]

      rates.push({
        period,
        total: value.total,
        done: value.done,
        done_rate: value.total === 0 ? 0 : value.done / value.total,
      })
    }

    rates.sort((a, b) => (a.period < b.period ? 1 : -1))

    return rates
  }
}
