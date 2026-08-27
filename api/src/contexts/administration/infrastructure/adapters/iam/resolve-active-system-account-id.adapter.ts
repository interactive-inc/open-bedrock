import type { Context } from "@/env"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemAccountRepository } from "@system/infrastructure/auth/system-account.repository"

/** Sessionが指すcanonical Accountの存在と現在の有効性を確認する。 */
export class ResolveActiveSystemAccountIdAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async resolve(accountId: AccountId): Promise<AccountId | Error> {
    const account = await new SystemAccountRepository({ database: this.c.env.DB }).findById(
      accountId,
    )
    if (account instanceof Error) {
      return new Error("failed to resolve canonical System Account", { cause: account })
    }
    return account?.status === "active"
      ? accountId
      : new Error("canonical System Account is not active")
  }
}
