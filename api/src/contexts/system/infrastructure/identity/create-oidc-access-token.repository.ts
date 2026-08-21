import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { oidcAccessTokenLifetime } from "@system/domain/values/oauth/oidc-token-lifetime.value"
import type {
  SystemClockContext,
  SystemDatabaseContext,
} from "@system/infrastructure/configuration/system-context.repository"
import { createOidcSecret } from "@system/infrastructure/identity/create-oidc-secret.repository"
import { hashOidcSecret } from "@system/infrastructure/identity/hash-oidc-secret.repository"
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
  const expiresAt = new Date(now.getTime() + oidcAccessTokenLifetime.milliseconds)
  const accessToken = createOidcSecret()
  const tokenHash = await hashOidcSecret(accessToken)

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
