import type { AccountId } from "@system/domain/auth/account-id"
import { OidcValue } from "@system/domain/identity/oidc.value"
import type {
  SystemClockContext,
  SystemDatabaseContext,
} from "@system/infrastructure/configuration/system-context"
import { createOidcSecret } from "@system/infrastructure/identity/create-oidc-secret"
import { hashOidcSecret } from "@system/infrastructure/identity/hash-oidc-secret"
import { systemOidcAuthorizationCodes } from "@system/infrastructure/schema/system-core"
import { lte } from "drizzle-orm"

type Props = Readonly<{
  issuer: string
  clientId: string
  redirectUri: string
  accountId: AccountId
  codeChallenge: string
  nonce: string
  scope: ReadonlyArray<string>
}>

/** hashだけを保存する短命OIDC authorization codeを発行する。 */
export async function createOidcAuthorizationCode(
  context: SystemDatabaseContext & SystemClockContext,
  props: Props,
): Promise<Readonly<{ code: string; expiresAt: Date }> | Error> {
  const now = context.var.now()
  const expiresAt = new Date(now.getTime() + OidcValue.AUTHORIZATION_CODE_MAX_AGE_MS)
  const code = createOidcSecret()
  const codeHash = await hashOidcSecret(code)

  try {
    await context.var.database
      .delete(systemOidcAuthorizationCodes)
      .where(lte(systemOidcAuthorizationCodes.expiresAt, now))
    await context.var.database.insert(systemOidcAuthorizationCodes).values({
      codeHash,
      issuer: props.issuer,
      clientId: props.clientId,
      redirectUri: props.redirectUri,
      accountId: props.accountId,
      codeChallenge: props.codeChallenge,
      nonce: props.nonce,
      scope: props.scope.join(" "),
      expiresAt,
      createdAt: now,
    })

    return Object.freeze({ code, expiresAt })
  } catch (caught) {
    return caught instanceof Error ? caught : new Error("authorization code write failed")
  }
}
