import { LeaveBalance } from "@/domain/leave/leave-balance.entity"
import type { Context } from "@/env"
import { leaveBalances } from "@/schema"
import { and, eq, gte, sql } from "drizzle-orm"

// 残数消費の結果。consumed=消費できた / insufficient=残数不足で消費できなかった。
export type ConsumeOutcome = "consumed" | "insufficient"

export class LeaveBalanceRepository {
  constructor(private readonly c: Context) {}

  async findByKey(props: {
    employeeId: number
    fiscalYear: string
    leaveType: "annual" | "special"
  }): Promise<LeaveBalance | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(leaveBalances)
        .where(
          and(
            eq(leaveBalances.employeeId, props.employeeId),
            eq(leaveBalances.fiscalYear, props.fiscalYear),
            eq(leaveBalances.leaveType, props.leaveType),
          ),
        )
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : LeaveBalance.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load leave_balance")
    }
  }

  // 休暇残数の消費を 1 ステートメントで原子的に行う。
  // remaining_days >= days のときだけ used_days を加算し remaining_days を減算する。
  // D1 は個々のステートメントを直列化するため、同時承認でも合計が残数を超える分は必ず弾かれる。
  // 0 行更新は残数不足。
  async consumeDays(props: {
    employeeId: number
    leaveType: "annual" | "special"
    fiscalYear: string
    days: number
  }): Promise<ConsumeOutcome | Error> {
    try {
      const rows = await this.c.var.database
        .update(leaveBalances)
        .set({
          usedDays: sql`${leaveBalances.usedDays} + ${props.days}`,
          remainingDays: sql`${leaveBalances.remainingDays} - ${props.days}`,
        })
        .where(
          and(
            eq(leaveBalances.employeeId, props.employeeId),
            eq(leaveBalances.leaveType, props.leaveType),
            eq(leaveBalances.fiscalYear, props.fiscalYear),
            gte(leaveBalances.remainingDays, props.days),
          ),
        )
        .returning()

      return rows.at(0) === undefined ? "insufficient" : "consumed"
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to consume leave balance")
    }
  }
}
