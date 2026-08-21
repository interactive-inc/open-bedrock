import {
  OidcInvalidGrantApplicationError,
  OidcTemporarilyUnavailableApplicationError,
} from "@system/application/auth/errors"
import { createSystemOidcAudit } from "@system/domain/audit/create-system-oidc-audit"
import {
  OidcClientPolicy,
  type OidcClientRegistry,
} from "@system/domain/identity/oidc-client.policy"
import { OidcScopeValue } from "@system/domain/identity/oidc-scope.value"
import { OidcValue } from "@system/domain/identity/oidc.value"
import { SystemAuditEventRepository } from "@system/infrastructure/audit/system-audit-event.repository"
import type {
  SystemClockContext,
  SystemD1Context,
  SystemDatabaseContext,
  SystemOidcSigningContext,
} from "@system/infrastructure/configuration/system-context.repository"
import { createOidcAccessToken } from "@system/infrastructure/identity/create-oidc-access-token.repository"
import { consumeOidcAuthorizationCode } from "@system/infrastructure/identity/consume-oidc-authorization-code.repository"
import { OidcIdTokenService } from "@system/infrastructure/identity/oidc-id-token.service.repository"
import { OidcSigningKeyService } from "@system/infrastructure/identity/oidc-signing-key.service.repository"
import { SystemOidcIdentityRepository } from "@system/infrastructure/identity/system-oidc-identity.repository"

type Props = Readonly<{
  issuer: string
  code: string
  clientId: string
  redirectUri: string
  codeVerifier: string
  clientRegistry: OidcClientRegistry
}>

/** OIDC codeの検証・消費からtoken発行・監査までを一つの操作として実行する。 */
export class ExchangeOidcAuthorizationCode {
  constructor(
    private readonly context: SystemDatabaseContext &
      SystemD1Context &
      SystemClockContext &
      SystemOidcSigningContext,
  ) {
    Object.freeze(this)
  }

  async execute(props: Props) {
    const client = OidcClientPolicy.resolve(props, props.clientRegistry)
    if (client === null) return new OidcInvalidGrantApplicationError()

    const signingKeys = OidcSigningKeyService.parse(this.context.env.OIDC_SIGNING_KEYS)
    if (signingKeys instanceof Error) {
      return new OidcTemporarilyUnavailableApplicationError(signingKeys)
    }

    const authorizationCode = await consumeOidcAuthorizationCode(this.context, {
      issuer: props.issuer,
      clientId: client.id,
      redirectUri: props.redirectUri,
      code: props.code,
      verifier: props.codeVerifier,
    })
    if (authorizationCode instanceof Error) {
      return new OidcTemporarilyUnavailableApplicationError(authorizationCode)
    }
    if (authorizationCode === null) return new OidcInvalidGrantApplicationError()

    const scope = OidcScopeValue.parse(authorizationCode.scope)
    if (scope instanceof Error) return new OidcInvalidGrantApplicationError(scope)

    const identity = await new SystemOidcIdentityRepository(this.context).findByAccountId(
      authorizationCode.accountId,
    )
    if (identity instanceof Error) {
      return new OidcTemporarilyUnavailableApplicationError(identity)
    }
    if (identity === null) return new OidcInvalidGrantApplicationError()

    const idToken = await new OidcIdTokenService(this.context).create({
      keys: signingKeys,
      issuer: props.issuer,
      clientId: client.id,
      identity,
      nonce: authorizationCode.nonce,
      scope,
    })
    if (idToken instanceof Error) return new OidcTemporarilyUnavailableApplicationError(idToken)

    const accessToken = await createOidcAccessToken(this.context, {
      issuer: props.issuer,
      clientId: client.id,
      accountId: authorizationCode.accountId,
      scope: scope.join(" "),
    })
    if (accessToken instanceof Error) {
      return new OidcTemporarilyUnavailableApplicationError(accessToken)
    }

    const audit = createSystemOidcAudit({
      accountId: authorizationCode.accountId,
      action: "auth.oidc.token_exchange",
      outcome: "succeeded",
      reasonCode: null,
      authorization: null,
      metadata: { issuer: props.issuer, clientId: client.id, scope: scope.join(" ") },
      occurredAt: this.context.var.now(),
    })
    if (audit instanceof Error) return new OidcTemporarilyUnavailableApplicationError(audit)

    const appended = await new SystemAuditEventRepository(this.context).append(audit)
    if (appended instanceof Error) {
      return new OidcTemporarilyUnavailableApplicationError(appended)
    }

    return {
      access_token: accessToken.accessToken,
      token_type: "Bearer" as const,
      expires_in: OidcValue.TOKEN_MAX_AGE_SECONDS,
      id_token: idToken,
      scope: scope.join(" "),
    }
  }
}
