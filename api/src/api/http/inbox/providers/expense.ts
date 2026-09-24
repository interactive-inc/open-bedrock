import type { InboxBusinessCounts, InboxCountInput } from "@/api/http/inbox/inbox-count-input"
import { ExpenseProcedureInboxAdapter } from "@/contexts/expense/infrastructure/adapters/expense-procedure-inbox.adapter"
import type { Context } from "@/env"
import { ApplicationError } from "@/lib/errors"
import { resolveDisabledFeatureKeys } from "@/api/http/features/resolve-disabled-feature-keys"

/** 経費の承認待ち件数。App が無効、または承認権限が無ければ数えない。 */
export async function readInboxCountsExpense(
  context: Context,
  input: InboxCountInput,
): Promise<Partial<InboxBusinessCounts> | ApplicationError> {
  const enabled = !resolveDisabledFeatureKeys({
    enabledOptInApps: context.env.ENABLED_OPT_IN_APPS,
    disabledDefaultApps: context.env.DISABLED_DEFAULT_APPS,
  }).includes("expenses")
  if (!enabled || !input.session.hasPermission("expense:approve")) return {}
  const page = await new ExpenseProcedureInboxAdapter(context).list({
    session: input.session,
    tokenVersion: input.tokenVersion,
    at: new Date(context.env.NOW ?? Date.now()),
    limit: 20,
    offset: 0,
  })
  if (page instanceof ApplicationError) return page
  return { expenses: page.data.length, expenses_has_more: page.next_offset !== null }
}
