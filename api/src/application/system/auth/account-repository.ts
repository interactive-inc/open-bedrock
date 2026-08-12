import type { AccountId } from "@system/domain/auth/account-id"
import type { Account } from "@system/domain/auth/account.entity"

/** canonical System Account aggregateを取得するApplication port。 */
export type AccountRepository = Readonly<{
  findById: (accountId: AccountId) => Promise<Account | null | Error>
}>
