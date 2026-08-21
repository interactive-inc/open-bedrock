import type { AccountId } from "@system/domain/auth/account-id"
import type { SystemAuthorizationGraph } from "@system/domain/iam/system-authorization-graph"

export type SystemAuthorizationRepository = Readonly<{
  loadForAccount(accountId: AccountId): Promise<SystemAuthorizationGraph | null | Error>
}>
