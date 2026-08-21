import type { AccountId } from "@system/domain/values/account-id.schema"
import { zAccountId } from "@system/domain/values/account-id.schema"
import { readBearerAuthorization } from "@system/interface/http/authorization/bearer-authorization"
import { SystemAccessTokenSecretValue } from "@system/domain/values/system-access-token-secret.value"
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

    const accessTokenSecret = SystemAccessTokenSecretValue.create(jwtSecret)
    if (!(accessTokenSecret instanceof SystemAccessTokenSecretValue)) {
      return { kind: "unavailable", reason: "account" }
    }

    const claims = await new AccessTokenService({
      profile: SYSTEM_ACCESS_TOKEN_PROFILE,
    }).verify(
      bearerAuthorization.token,
      accessTokenSecret.toString(),
      this.props.accessTokenVerificationTime ?? new Date(),
    )
    if (claims instanceof Error) return { kind: "rejected", reason: "invalid_token" }

    const accountId = zAccountId.safeParse(claims.sub)
    if (!accountId.success) return { kind: "rejected", reason: "invalid_token" }

    const accountSession = await SystemAccountRepository.resolveSession({
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

    const authorization = await new SystemD1AuthorizationRepository({
      env: { DB: this.props.database },
    }).resolveForAccount({ accountId: accountId.data, resource: null, at: now })
    if (authorization instanceof Error) return { kind: "unavailable", reason: "authorization" }
    if (authorization === null) return { kind: "rejected", reason: "account_inactive" }

    return Object.freeze({
      kind: "authenticated",
      accountId: accountId.data,
      tokenVersion: accountSession.account.tokenVersion,
      permissionKeys: authorization.permissionKeys,
      roleKeys: authorization.roleKeys,
    })
  }
}
