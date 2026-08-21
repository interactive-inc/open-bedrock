import { zAccountId, type AccountId } from "@system/domain/values/account-id.schema"
import { SystemAccountRepository } from "@system/infrastructure/auth/system-account.repository"
import type { CompanyContext } from "@/contexts/company/infrastructure/configuration/company-context.repository"

/** Company の操作主体が active な canonical System Account かを確認する。 */
export async function resolveActiveSystemAccountId(
  context: CompanyContext,
  accountIdInput: string,
): Promise<AccountId | Error> {
  const accountId = zAccountId.safeParse(accountIdInput)
  if (!accountId.success) return new Error("canonical System Account ID is invalid")

  const account = await new SystemAccountRepository({ database: context.env.DB }).findById(
    accountId.data,
  )
  if (account instanceof Error) {
    return new Error("failed to resolve canonical System Account", { cause: account })
  }

  return account?.status === "active"
    ? accountId.data
    : new Error("canonical System Account is not active")
}
