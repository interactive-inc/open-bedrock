import type { AccountId } from "@system/domain/auth/account-id"
import { OidcValue } from "@system/domain/identity/oidc.value"
import type {
  SystemClockContext,
  SystemDatabaseContext,
} from "@system/infrastructure/configuration/system-context"
import { OidcCryptographyService } from "@system/infrastructure/identity/oidc-cryptography.service"
import { systemOidcAccessTokens } from "@system/infrastructure/schema/system-core"
import { lte } from "drizzle-orm"

type Props = Readonly<{
  issuer: string
  clientId: string
  accountId: AccountId
  scope: string
}>

/** 平文を保存しない短命OIDC access tokenを発行する。 */
export async function createOidcAccessToken(
  context: SystemDatabaseContext & SystemClockContext,
  props: Props,
): Promise<Readonly<{ accessToken: string; expiresAt: Date }> | Error> {
  const now = context.var.now()
  const expiresAt = new Date(now.getTime() + OidcValue.TOKEN_MAX_AGE_MS)
  const accessToken = OidcCryptographyService.createSecret()
  const tokenHash = await OidcCryptographyService.hashSecret(accessToken)

  try {
    await context.var.database
      .delete(systemOidcAccessTokens)
      .where(lte(systemOidcAccessTokens.expiresAt, now))
    await context.var.database.insert(systemOidcAccessTokens).values({
      tokenHash,
      issuer: props.issuer,
      clientId: props.clientId,
      accountId: props.accountId,
      scope: props.scope,
      expiresAt,
      createdAt: now,
    })

    return Object.freeze({ accessToken, expiresAt })
  } catch (caught) {
    return caught instanceof Error ? caught : new Error("access token write failed")
  }
}
