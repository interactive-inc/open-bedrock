import type { InboxBusinessCounts, InboxCountInput } from "@/api/http/inbox/inbox-count-input"
import { LeaveProcedureInboxAdapter } from "@/contexts/leave/infrastructure/adapters/leave-procedure-inbox.adapter"
import type { Context } from "@/env"
import { ApplicationError } from "@/lib/errors"
import { resolveDisabledFeatureKeys } from "@/api/http/features/resolve-disabled-feature-keys"

/** 休暇の承認待ち件数。App が無効、または承認資格が無ければ数えない。 */
export async function readInboxCountsLeave(
  context: Context,
  input: InboxCountInput,
): Promise<Partial<InboxBusinessCounts> | ApplicationError> {
  const enabled = !resolveDisabledFeatureKeys({
    enabledOptInApps: context.env.ENABLED_OPT_IN_APPS,
    disabledDefaultApps: context.env.DISABLED_DEFAULT_APPS,
  }).includes("leave")
  if (!enabled || !input.canApproveLeaves) return {}
  const page = await new LeaveProcedureInboxAdapter(context).list({
    session: input.session,
    tokenVersion: input.tokenVersion,
    at: new Date(context.env.NOW ?? Date.now()),
    limit: 20,
    offset: 0,
  })
  if (page instanceof ApplicationError) return page
  return { leaves: page.data.length, leaves_has_more: page.next_offset !== null }
}
