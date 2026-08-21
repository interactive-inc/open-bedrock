import { StableSystemAuditJsonValue } from "@system/domain/values/stable-system-audit-json.value"
import { SystemAccessTokenSecretValue } from "@system/domain/values/system-access-token-secret.value"
import { IssueSystemSession } from "@system/application/auth/issue-system-session"
import { SystemIdentityLoginAuditRecorder } from "@system/infrastructure/audit/system-identity-login-audit-recorder.repository"
import { SystemAccessTokenIssuer } from "@system/infrastructure/auth/system-access-token-issuer.repository"
import { SystemAccountRepository } from "@system/infrastructure/auth/system-account.repository"
import { recordSystemIdentityLoginToken } from "@system/infrastructure/auth/record-system-identity-login-token.repository"
import { SystemIdentityLoginRepository } from "@system/infrastructure/auth/system-identity-login.repository"
import { SystemIdentityTokenVerifier } from "@system/infrastructure/auth/system-identity-token-verifier.repository"
import { SystemIdentityVerificationKeyResolver } from "@system/infrastructure/auth/system-identity-verification-key-resolver.repository"
import { SystemSessionMaterialService } from "@system/infrastructure/auth/system-session-material.service.repository"
import { SystemSessionRepository } from "@system/infrastructure/auth/system-session.repository"

type Props = Readonly<{
  database: D1Database
  jwtSecret: string
  identityJwks?: string
  identityIssuer: string
  identityAudience: string
  sessionTtlMilliseconds: number
}>

export type SystemIdentitySessionIssuance =
  | Readonly<{
      kind: "issued"
      accountId: string
      accessToken: string
      refreshToken: string
      sessionId: string
      expiresAt: Date
    }>
  | Readonly<{
      kind: "rejected"
      reason:
        | "invalid_token"
        | "email_unverified"
        | "token_replayed"
        | "account_not_found"
        | "account_inactive"
    }>
  | Readonly<{ kind: "unavailable" }>

/** 検証済み外部IdentityからCompanyを介さずSystem Sessionを発行する。 */
export class IssueSystemIdentitySession {
  constructor(private readonly props: Props) {
    Object.freeze(this)
  }

  async issue(token: string, now: Date): Promise<SystemIdentitySessionIssuance> {
    if (
      !Number.isSafeInteger(now.getTime()) ||
      !Number.isSafeInteger(this.props.sessionTtlMilliseconds) ||
      this.props.sessionTtlMilliseconds <= 0 ||
      !(
        SystemAccessTokenSecretValue.create(this.props.jwtSecret) instanceof
        SystemAccessTokenSecretValue
      )
    ) {
      return { kind: "unavailable" }
    }
    const verificationKey = new SystemIdentityVerificationKeyResolver({
      jwks: this.props.identityJwks,
      issuer: this.props.identityIssuer,
    }).resolve()
    if (verificationKey instanceof Error) return { kind: "unavailable" }

    const claims = await new SystemIdentityTokenVerifier().verify({
      token,
      verificationKey,
      issuer: this.props.identityIssuer,
      audience: this.props.identityAudience,
      now,
    })
    if ("reason" in claims) return await this.reject("invalid_token", now)
    if (claims.email_verified !== true) return await this.reject("email_unverified", now)

    const replay = await recordSystemIdentityLoginToken(
      { env: { DB: this.props.database } },
      { jti: claims.jti, expiresAt: new Date(claims.exp * 1_000), usedAt: now },
    )
    if (replay instanceof Error) return { kind: "unavailable" }
    if (replay === "replayed") return await this.reject("token_replayed", now)

    const login = await new SystemIdentityLoginRepository({
      env: { DB: this.props.database },
    }).find("oidc", claims.sub)
    if (login instanceof Error) return { kind: "unavailable" }
    if (login === null) return await this.reject("account_not_found", now)
    if (login.account.status !== "active") return await this.reject("account_inactive", now)

    const metadataJson = StableSystemAuditJsonValue.create({
      transport: "system.v1.identity-sessions",
    })
    if (metadataJson instanceof Error) return { kind: "unavailable" }
    const systemContext = { env: { DB: this.props.database } }
    const issuance = await new IssueSystemSession({
      accountRepository: new SystemAccountRepository({ database: this.props.database }),
      sessionRepository: new SystemSessionRepository({ context: systemContext }),
      materialService: new SystemSessionMaterialService(),
      accessTokenIssuer: new SystemAccessTokenIssuer(this.props.jwtSecret),
      sessionTtlMilliseconds: this.props.sessionTtlMilliseconds,
    }).execute({
      accountId: login.account.id,
      tokenVersion: login.account.tokenVersion,
      now,
      auditContext: { authorizationJson: null, metadataJson: metadataJson?.toString() ?? null },
    })
    if (issuance instanceof Error) return { kind: "unavailable" }
    if (issuance.kind === "rejected") return await this.reject("account_inactive", now)

    return Object.freeze({
      kind: "issued",
      accountId: issuance.accountId,
      accessToken: issuance.accessToken,
      refreshToken: issuance.rawToken,
      sessionId: issuance.sessionId,
      expiresAt: issuance.expiresAt,
    })
  }

  private async reject(
    reason: Extract<SystemIdentitySessionIssuance, { kind: "rejected" }>["reason"],
    now: Date,
  ): Promise<SystemIdentitySessionIssuance> {
    const audit = await new SystemIdentityLoginAuditRecorder({
      env: { DB: this.props.database },
    }).recordDenied(reason, now)

    return audit instanceof Error ? { kind: "unavailable" } : { kind: "rejected", reason }
  }
}
