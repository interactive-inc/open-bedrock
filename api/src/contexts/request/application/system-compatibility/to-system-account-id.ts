import { zAccountId, type AccountId } from "@system/domain/auth/account-id"
import type { Context } from "@/env"

/**
 * legacy Session の整数 ID を、System 境界でだけ canonical Account ID へ投影する。
 *
 * この adapter は legacy ID の採番規則を System domain へ持ち込まない。
 * 対応する正本の存在と状態は、各 command の system_accounts join / FK が検証する。
 */
export function toSystemAccountId(legacyAccountId: number): AccountId | Error {
  if (!Number.isSafeInteger(legacyAccountId) || legacyAccountId < 0) {
    return new Error("legacy account ID cannot be represented as a System Account ID")
  }

  const parsed = zAccountId.safeParse(String(legacyAccountId))
  return parsed.success
    ? parsed.data
    : new Error("legacy account ID cannot be represented as a System Account ID", {
        cause: parsed.error,
      })
}

/** legacy Session が指す canonical Account の存在と現在の有効性を確認する。 */
export async function resolveActiveSystemAccountId(
  c: Context,
  legacyAccountId: number,
): Promise<AccountId | Error> {
  const accountId = toSystemAccountId(legacyAccountId)
  if (accountId instanceof Error) return accountId

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
