import { LeaveDecisionNotificationDeliveryAdapter } from "@/contexts/leave/infrastructure/adapters/leave-decision-notification-delivery.adapter"
import { resolveDisabledFeatureKeys } from "@/lib/feature/resolve-disabled-feature-keys"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { Bindings } from "@/env"

/** 明示したServiceで、確定済み休暇判断の通知を再送する。 */
export async function runScheduledLeaveNotifications(
  input: Readonly<{
    env: Pick<
      Bindings,
      | "DB"
      | "COMPANY_TIME_ZONE"
      | "LEAVE_NOTIFICATION_SERVICE_ACCOUNT_ID"
      | "ENABLED_OPT_IN_APPS"
      | "DISABLED_DEFAULT_APPS"
    >
    clock: () => Date
  }>,
) {
  if (
    resolveDisabledFeatureKeys({
      enabledOptInApps: input.env.ENABLED_OPT_IN_APPS,
      disabledDefaultApps: input.env.DISABLED_DEFAULT_APPS,
    }).includes("leave")
  )
    return []
  if (input.env.LEAVE_NOTIFICATION_SERVICE_ACCOUNT_ID === undefined) return []
  const account = zAccountId.safeParse(input.env.LEAVE_NOTIFICATION_SERVICE_ACCOUNT_ID)
  if (!account.success) return new Error("leave notification Service configuration is invalid")
  return new LeaveDecisionNotificationDeliveryAdapter({
    env: input.env,
    accountId: account.data,
    clock: input.clock,
  }).run(50)
}
