import { zAccountId, type AccountId } from "@system/domain/auth/account-id"

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
