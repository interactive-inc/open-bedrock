import type { Context } from "@/env"
import { UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { toManagementDashboardRanges } from "@/api/http/dashboard/management/to-management-dashboard-ranges"
import type { AppManagementDashboard } from "@/api/http/company/response-schemas"
import { attendanceRecords } from "@/contexts/attendance/infrastructure/schema/attendance"
import { employeeEvents } from "@/contexts/company/infrastructure/schema/employee-event"
import { ReadCanonicalOrganizationStateAdapter } from "@/contexts/company/infrastructure/adapters/organization/read-canonical-organization-state.adapter"
import { expenses } from "@/contexts/expense/infrastructure/schema/expense"
import { goals } from "@/contexts/performance-review/infrastructure/schema/goal"
import { leaveRequests } from "@/contexts/leave/infrastructure/schema/leave"
import { reviewCycles } from "@/contexts/performance-review/infrastructure/schema/performance-review"
import { CountPendingSystemCasesAdapter } from "@system/infrastructure/adapters/workflow/count-pending-system-cases.adapter"
import { and, count, eq, gte, like } from "drizzle-orm"

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

      const pendingApplicationCount = await new CountPendingSystemCasesAdapter({
        env: { DB: this.c.env.DB },
      }).countPendingSystemCases()
      if (pendingApplicationCount instanceof Error) {
        return new UnexpectedError("failed to aggregate management dashboard", {
          cause: pendingApplicationCount,
        })
      }

      const companySnapshot = await new ReadCanonicalOrganizationStateAdapter(
        this.c,
      ).readCanonicalOrganizationState()
      if (companySnapshot instanceof Error) {
        return new UnexpectedError("failed to aggregate management dashboard", {
          cause: companySnapshot,
        })
      }
      const activeStates = companySnapshot.employees.filter((state) => state.status === "ACTIVE")
      const unitById = new Map(
        companySnapshot.organization.units.map((unit) => [unit.organizationUnitId, unit]),
      )
      const headcountByUnitName = new Map<string, number>()
      for (const state of activeStates) {
        if (state.primaryAssignment === null) continue
        const unit = unitById.get(state.primaryAssignment.organizationUnitId)
        if (unit === undefined) continue
        headcountByUnitName.set(
          unit.officialName,
          (headcountByUnitName.get(unit.officialName) ?? 0) + 1,
        )
      }

      const [
        joinRows,
        retireRows,
        attendanceRows,
        leaveMonthRows,
        leavePendingRows,
        expenseMonthRows,
        expensePendingRows,
        openReviewCycleRows,
      ] = await database.batch([
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
      ])

      const goalRows = await database
        .select({
          period: goals.period,
          status: goals.status,
          total: count(),
        })
        .from(goals)
        .groupBy(goals.period, goals.status)

      return {
        employee_count: activeStates.length,
        department_headcounts: [...headcountByUnitName]
          .map(([department_name, headcount]) => ({ department_name, headcount }))
          .toSorted((left, right) => right.headcount - left.headcount),
        recent_join_count: joinRows.at(0)?.total ?? 0,
        recent_retire_count: retireRows.at(0)?.total ?? 0,
        attendance_record_count: attendanceRows.at(0)?.total ?? 0,
        leave_request_count: leaveMonthRows.at(0)?.total ?? 0,
        leave_pending_count: leavePendingRows.at(0)?.total ?? 0,
        expense_count: expenseMonthRows.at(0)?.total ?? 0,
        expense_pending_count: expensePendingRows.at(0)?.total ?? 0,
        open_review_cycle_count: openReviewCycleRows.at(0)?.total ?? 0,
        pending_application_count: pendingApplicationCount,
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
