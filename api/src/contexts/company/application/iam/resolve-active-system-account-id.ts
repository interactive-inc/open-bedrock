import type { Context } from "@/env"
import type { AccountId } from "@system/domain/auth/account-id"

/** Sessionが指すcanonical Accountの存在と現在の有効性を確認する。 */
export async function resolveActiveSystemAccountId(
  c: Context,
  accountId: AccountId,
): Promise<AccountId | Error> {
  try {
    const activeId = await c.env.DB.prepare(
      "SELECT id FROM system_accounts WHERE id = ?1 AND status = 'active'",
    )
      .bind(accountId)
      .first<string>("id")
    return activeId === accountId ? accountId : new Error("canonical System Account is not active")
  } catch (cause) {
    return new Error("failed to resolve canonical System Account", { cause })
  }
}
