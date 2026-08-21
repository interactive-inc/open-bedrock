import type { AccountRepository } from "@system/infrastructure/auth/account-port.repository"
import type { AccountId } from "@system/domain/auth/account-id"
import type { Account } from "@system/domain/auth/account.entity"
import { getAccountSessionRejection } from "@system/domain/auth/get-account-session-rejection"
import type { AccountSessionRejection } from "@system/domain/auth/get-account-session-rejection"

export type ResolvedAccountSession =
  | Readonly<{ kind: "accepted"; account: Account }>
  | Readonly<{ kind: "rejected"; reason: AccountSessionRejection | "account_not_found" }>

type Props = Readonly<{
  accountRepository: AccountRepository
  accountId: AccountId
  sessionTokenVersion: number
}>

/** canonical Accountの現在状態からSession継続可否を解決する。 */
export async function resolveAccountSession(props: Props): Promise<ResolvedAccountSession | Error> {
  const account = await props.accountRepository.findById(props.accountId)

  if (account instanceof Error) return account
  if (account === null) return { kind: "rejected", reason: "account_not_found" }

  const rejection = getAccountSessionRejection({
    accountStatus: account.status,
    accountTokenVersion: account.tokenVersion,
    sessionTokenVersion: props.sessionTokenVersion,
  })

  return rejection === null
    ? { kind: "accepted", account }
    : { kind: "rejected", reason: rejection }
}
