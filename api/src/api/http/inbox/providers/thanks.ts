import type { InboxBusinessCounts, InboxCountInput } from "@/api/http/inbox/inbox-count-input"
import { thanksRedemptions } from "@/contexts/thanks/infrastructure/schema/thanks"
import type { Context } from "@/env"
import { and, count, eq, ne } from "drizzle-orm"

/** 本人の申請でない、承認待ちの感謝point交換の件数。 */
export async function readInboxCountsThanks(
  context: Context,
  input: InboxCountInput,
): Promise<Partial<InboxBusinessCounts>> {
  if (!input.canApproveThanksRedemptions) return {}
  const rows = await context.var.database
    .select({ total: count() })
    .from(thanksRedemptions)
    .where(
      and(
        eq(thanksRedemptions.status, "pending"),
        ne(thanksRedemptions.employeeId, input.session.employeeId),
      ),
    )
  return { thanks: rows.at(0)?.total ?? 0 }
}
