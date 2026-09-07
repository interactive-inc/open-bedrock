import { ExpenseProcedureInboxAdapter } from "@/contexts/expense/infrastructure/adapters/expense-procedure-inbox.adapter"
import { resolveDisabledFeatureKeys } from "@/lib/feature/resolve-disabled-feature-keys"
import { ApplicationError } from "@/lib/errors"
import type { CompanyPersonnelSession } from "@/contexts/company/domain/definitions/company-personnel-session.definition"
import { leaveRequests } from "@/contexts/leave/infrastructure/schema/leave"
import { shiftSwapRequests } from "@/contexts/shift/infrastructure/schema/shift"
import { thanksRedemptions } from "@/contexts/thanks/infrastructure/schema/thanks"
import type { Context } from "@/env"
import { and, count, eq, ne } from "drizzle-orm"

/** 各業務contextの未処理件数を権限に応じて製品inboxへ合成する。 */
export async function readInboxBusinessCounts(
  context: Context,
  input: Readonly<{
    session: CompanyPersonnelSession
    tokenVersion: number
    canApproveLeaves: boolean
    canApproveShiftSwaps: boolean
    canApproveThanksRedemptions: boolean
  }>,
) {
  const [leaveRows, shiftRows, thanksRows] = await Promise.all([
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
              ne(shiftSwapRequests.requesterEmployeeId, input.session.employeeId),
              ne(shiftSwapRequests.targetEmployeeId, input.session.employeeId),
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
              ne(thanksRedemptions.employeeId, input.session.employeeId),
            ),
          )
      : Promise.resolve([]),
  ])

  const expenseEnabled = !resolveDisabledFeatureKeys({
    enabledOptInApps: context.env.ENABLED_OPT_IN_APPS,
    disabledDefaultApps: context.env.DISABLED_DEFAULT_APPS,
  }).includes("expenses")
  const expensePage =
    expenseEnabled && input.session.hasPermission("expense:approve")
      ? await new ExpenseProcedureInboxAdapter(context).list({
          session: input.session,
          tokenVersion: input.tokenVersion,
          at: new Date(context.env.NOW ?? Date.now()),
          limit: 20,
          offset: 0,
        })
      : { data: [], next_offset: null }
  if (expensePage instanceof ApplicationError) return expensePage

  return {
    expenses: expensePage.data.length,
    expenses_has_more: expensePage.next_offset !== null,
    leaves: leaveRows.at(0)?.total ?? 0,
    shifts: shiftRows.at(0)?.total ?? 0,
    thanks: thanksRows.at(0)?.total ?? 0,
  }
}
