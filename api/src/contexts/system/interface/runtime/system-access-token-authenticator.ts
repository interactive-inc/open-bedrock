import { resolveAccountSession } from "@system/domain/auth/resolve-account-session"
import { resolveSystemAuthorization } from "@system/domain/iam/resolve-system-authorization"
import type { AccountId } from "@system/domain/auth/account-id"
import { zAccountId } from "@system/domain/auth/account-id"
import { readBearerAuthorization } from "@system/interface/lib/authorization/bearer-authorization"
import { validateSystemAccessTokenSecret } from "@system/domain/auth/validate-system-access-token-secret"
import { AccessTokenService } from "@system/infrastructure/auth/access-token-service.repository"
import { SystemAccountRepository } from "@system/infrastructure/auth/system-account.repository"
import { SYSTEM_ACCESS_TOKEN_PROFILE } from "@system/infrastructure/auth/system-access-token-profile.repository"
import { SystemD1AuthorizationRepository } from "@system/infrastructure/iam/system-authorization.repository"

type Props = Readonly<{
  database: D1Database
  accessTokenVerificationTime?: Date
}>

export type SystemAccessTokenAuthentication =
  | Readonly<{
      kind: "authenticated"
      accountId: AccountId
      tokenVersion: number
      permissionKeys: ReadonlySet<string>
      roleKeys: ReadonlyArray<string>
    }>
  | Readonly<{
      kind: "rejected"
      reason: "invalid_token" | "account_not_found" | "account_inactive" | "token_version_mismatch"
    }>
  | Readonly<{ kind: "unavailable"; reason: "account" | "authorization" }>

/** JWT、Account状態、token version、IAMをSystem内で検証する公開runtime境界。 */
export class SystemAccessTokenAuthenticator {
  constructor(private readonly props: Props) {
    Object.freeze(this)
  }

  async authenticate(
    authorizationHeader: string | undefined,
    jwtSecret: string,
    now: Date,
  ): Promise<SystemAccessTokenAuthentication> {
    const bearerAuthorization = readBearerAuthorization(authorizationHeader)
    if (bearerAuthorization.kind !== "token") {
      return { kind: "rejected", reason: "invalid_token" }
    }

    const invalidSecret = validateSystemAccessTokenSecret(jwtSecret)
    if (invalidSecret !== null) return { kind: "unavailable", reason: "account" }

    const claims = await new AccessTokenService({
      profile: SYSTEM_ACCESS_TOKEN_PROFILE,
    }).verify(
      bearerAuthorization.token,
      jwtSecret,
      this.props.accessTokenVerificationTime ?? new Date(),
    )
    if (claims instanceof Error) return { kind: "rejected", reason: "invalid_token" }

    const accountId = zAccountId.safeParse(claims.sub)
    if (!accountId.success) return { kind: "rejected", reason: "invalid_token" }

    const accountSession = await resolveAccountSession({
      accountRepository: new SystemAccountRepository({ database: this.props.database }),
      accountId: accountId.data,
      sessionTokenVersion: claims.ver,
    })
    if (accountSession instanceof Error) return { kind: "unavailable", reason: "account" }
    if (accountSession.kind === "rejected") {
      if (accountSession.reason === "invalid_account_token_version") {
        return { kind: "unavailable", reason: "account" }
      }
      if (accountSession.reason === "invalid_session_token_version") {
        return { kind: "rejected", reason: "invalid_token" }
      }

      if (accountSession.reason === "account_not_found") {
        return { kind: "rejected", reason: "account_not_found" }
      }
      if (accountSession.reason === "account_inactive") {
        return { kind: "rejected", reason: "account_inactive" }
      }

      return { kind: "rejected", reason: "token_version_mismatch" }
    }

    const authorizationGraph = await new SystemD1AuthorizationRepository({
      env: { DB: this.props.database },
    }).loadForAccount(accountId.data)
    if (authorizationGraph instanceof Error) {
      return { kind: "unavailable", reason: "authorization" }
    }
    if (authorizationGraph === null) return { kind: "rejected", reason: "account_inactive" }
    const authorization = resolveSystemAuthorization(authorizationGraph, {
      resource: null,
      at: now,
    })
    if (authorization instanceof Error) return { kind: "unavailable", reason: "authorization" }

    return Object.freeze({
      kind: "authenticated",
      accountId: accountId.data,
      tokenVersion: accountSession.account.tokenVersion,
      permissionKeys: authorization.permissionKeys,
      roleKeys: authorization.roleKeys,
    })
  }
}
