import { LeaveBalance } from "@/domain/leave/leave-balance"
import type { Context } from "@/env"
import { leaveBalances } from "@/schema"
import { and, eq } from "drizzle-orm"

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

  async update(leaveBalance: LeaveBalance): Promise<LeaveBalance | null | Error> {
    try {
      const rows = await this.c.var.database
        .update(leaveBalances)
        .set({
          usedDays: leaveBalance.usedDays,
          remainingDays: leaveBalance.remainingDays,
        })
        .where(
          and(
            eq(leaveBalances.employeeId, leaveBalance.employeeId),
            eq(leaveBalances.fiscalYear, leaveBalance.fiscalYear),
            eq(leaveBalances.leaveType, leaveBalance.leaveType),
          ),
        )
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : LeaveBalance.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update leave_balance")
    }
  }
}
