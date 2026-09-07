import { OnboardingLifecycleDeliveryAdapter } from "@/contexts/onboarding/infrastructure/adapters/onboarding-lifecycle-delivery.adapter"
import { resolveDisabledFeatureKeys } from "@/lib/feature/resolve-disabled-feature-keys"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { Bindings } from "@/env"
import { z } from "zod"

/** Workerの定期起動から、明示したServiceと開始時点で入退社の手続きを配送する。 */
export async function runScheduledOnboarding(
  input: Readonly<{
    env: Pick<
      Bindings,
      | "DB"
      | "COMPANY_TIME_ZONE"
      | "ONBOARDING_SERVICE_ACCOUNT_ID"
      | "ONBOARDING_AUTOMATION_FROM"
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
    }).includes("onboarding")
  )
    return []
  if (
    input.env.ONBOARDING_SERVICE_ACCOUNT_ID === undefined &&
    input.env.ONBOARDING_AUTOMATION_FROM === undefined
  )
    return []
  const account = zAccountId.safeParse(input.env.ONBOARDING_SERVICE_ACCOUNT_ID)
  const since = z.iso.datetime({ offset: true }).safeParse(input.env.ONBOARDING_AUTOMATION_FROM)
  if (!account.success || !since.success)
    return new Error("onboarding automation configuration is incomplete")
  return new OnboardingLifecycleDeliveryAdapter({
    env: input.env,
    accountId: account.data,
    recordedSince: new Date(since.data),
    clock: input.clock,
  }).run(50)
}
