import { hashOidcSecret } from "@system/infrastructure/identity/hash-oidc-secret.repository"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type {
  SystemClockContext,
  SystemDatabaseContext,
} from "@system/infrastructure/configuration/system-context.repository"
import { systemOidcAccessTokens } from "@system/infrastructure/schema/system-core"
import { and, eq, gt } from "drizzle-orm"

type Props = Readonly<{ issuer: string; accessToken: string }>

type OidcAccessToken = Readonly<{
  clientId: string
  accountId: AccountId
  scope: string
}>

/** issuerと有効期限に束縛したOIDC access tokenをhashで検索する。 */
export async function findOidcAccessToken(
  context: SystemDatabaseContext & SystemClockContext,
  props: Props,
): Promise<OidcAccessToken | null | Error> {
  const now = context.var.now()
  const tokenHash = await hashOidcSecret(props.accessToken)

  try {
    const tokens = await context.var.database
      .select({
        clientId: systemOidcAccessTokens.clientId,
        accountId: systemOidcAccessTokens.accountId,
        scope: systemOidcAccessTokens.scope,
      })
      .from(systemOidcAccessTokens)
      .where(
        and(
          eq(systemOidcAccessTokens.tokenHash, tokenHash),
          eq(systemOidcAccessTokens.issuer, props.issuer),
          gt(systemOidcAccessTokens.expiresAt, now),
        ),
      )
      .limit(1)

    return tokens.at(0) ?? null
  } catch (caught) {
    return caught instanceof Error ? caught : new Error("access token read failed")
  }
}
