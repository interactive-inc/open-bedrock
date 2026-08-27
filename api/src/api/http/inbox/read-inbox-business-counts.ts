import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { expenses } from "@/contexts/expense/infrastructure/schema/expense"
import { leaveRequests } from "@/contexts/leave/infrastructure/schema/leave"
import { shiftSwapRequests } from "@/contexts/shift/infrastructure/schema/shift"
import { thanksRedemptions } from "@/contexts/thanks/infrastructure/schema/thanks"
import type { Context } from "@/env"
import { and, count, eq, ne } from "drizzle-orm"

/** 各業務contextの未処理件数を権限に応じて製品inboxへ合成する。 */
export async function readInboxBusinessCounts(
  context: Context,
  input: Readonly<{
    employeeId: EmployeeId
    canApproveExpenses: boolean
    canApproveLeaves: boolean
    canApproveShiftSwaps: boolean
    canApproveThanksRedemptions: boolean
  }>,
) {
  const [expenseRows, leaveRows, shiftRows, thanksRows] = await Promise.all([
    input.canApproveExpenses
      ? context.var.database
          .select({ total: count() })
          .from(expenses)
          .where(eq(expenses.status, "pending"))
      : Promise.resolve([]),
    input.canApproveLeaves
      ? context.var.database
          .select({ total: count() })
          .from(leaveRequests)
          .where(eq(leaveRequests.status, "pending"))
      : Promise.resolve([]),
    input.canApproveShiftSwaps
      ? context.var.database
          .select({ total: count() })
          .from(shiftSwapRequests)
          .where(
            and(
              eq(shiftSwapRequests.status, "pending"),
              ne(shiftSwapRequests.requesterEmployeeId, input.employeeId),
              ne(shiftSwapRequests.targetEmployeeId, input.employeeId),
            ),
          )
      : Promise.resolve([]),
    input.canApproveThanksRedemptions
      ? context.var.database
          .select({ total: count() })
          .from(thanksRedemptions)
          .where(
            and(
              eq(thanksRedemptions.status, "pending"),
              ne(thanksRedemptions.employeeId, input.employeeId),
            ),
          )
      : Promise.resolve([]),
  ])

  return {
    expenses: expenseRows.at(0)?.total ?? 0,
    leaves: leaveRows.at(0)?.total ?? 0,
    shifts: shiftRows.at(0)?.total ?? 0,
    thanks: thanksRows.at(0)?.total ?? 0,
  }
}
