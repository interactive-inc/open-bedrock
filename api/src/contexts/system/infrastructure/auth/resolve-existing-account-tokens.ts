import {
  AccountTokenCollectionValue,
  type AccountToken,
} from "@/contexts/system/domain/auth/account-token-collection.value"
import { SessionTokenService } from "@/contexts/system/infrastructure/auth/session-token.service"

export async function resolveExistingAccountTokens(
  raw: string | undefined,
  secret: string,
): Promise<ReadonlyArray<AccountToken>> {
  const entries: AccountToken[] = []

  for (const token of AccountTokenCollectionValue.parse(raw)) {
    try {
      const payload = await SessionTokenService.verify(token, secret)
      entries.push({ userId: payload.accountId, token })
    } catch {
      // 改竄・期限切れトークンを切替候補へ残さない。
    }
  }

  return entries
}
