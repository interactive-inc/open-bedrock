import type { InboxBusinessCounts, InboxCountInput } from "@/api/http/inbox/inbox-count-input"
import { shiftSwapRequests } from "@/contexts/shift/infrastructure/schema/shift"
import type { Context } from "@/env"
import { and, count, eq, ne } from "drizzle-orm"

/** 本人が当事者でない、承認待ちのシフト交換の件数。 */
export async function readInboxCountsShift(
  context: Context,
  input: InboxCountInput,
): Promise<Partial<InboxBusinessCounts>> {
  if (!input.canApproveShiftSwaps) return {}
  const rows = await context.var.database
    .select({ total: count() })
    .from(shiftSwapRequests)
    .where(
      and(
        eq(shiftSwapRequests.status, "pending"),
        ne(shiftSwapRequests.requesterEmployeeId, input.session.employeeId),
        ne(shiftSwapRequests.targetEmployeeId, input.session.employeeId),
      ),
    )
  return { shifts: rows.at(0)?.total ?? 0 }
}
