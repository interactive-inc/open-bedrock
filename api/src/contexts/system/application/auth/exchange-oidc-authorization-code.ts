import {
  OidcInvalidGrantApplicationError,
  OidcTemporarilyUnavailableApplicationError,
} from "@/contexts/system/application/auth/errors"
import { AuthAuditLogRepository } from "@/contexts/system/infrastructure/audit/auth-audit-log.repository"
import { OidcAccessTokenRepository } from "@/contexts/system/infrastructure/identity/oidc-access-token.repository"
import { OidcAuthorizationCodeRepository } from "@/contexts/system/infrastructure/identity/oidc-authorization-code.repository"
import {
  OidcIdTokenService,
  type OidcIdentity,
} from "@/contexts/system/infrastructure/identity/oidc-id-token.service"
import {
  OidcSigningKeyService,
  type OidcSigningKeys,
} from "@/contexts/system/infrastructure/identity/oidc-signing-key.service"
import {
  OidcClientPolicy,
  type OidcClientRegistry,
} from "@system/domain/identity/oidc-client.policy"
import { WriteOperationEntity } from "@/lib/persistence/write-operation.entity"
import { OidcScopeValue } from "@system/domain/identity/oidc-scope.value"
import { OidcValue } from "@system/domain/identity/oidc.value"
import type {
  SystemClockContext,
  SystemDatabaseContext,
  SystemOidcSigningContext,
} from "@system/infrastructure/configuration/system-context"

type PrepareProps = Readonly<{
  issuer: string
  code: string
  clientId: string
  redirectUri: string
  codeVerifier: string
  clientRegistry: OidcClientRegistry
}>

type PreparedExchange = Readonly<{
  clientId: string
  signingKeys: OidcSigningKeys
  authorizationCode: Readonly<{ userId: string; nonce: string }>
  scope: ReadonlyArray<string>
}>
type Props = Readonly<{
  issuer: string
  prepared: PreparedExchange
  identity: OidcIdentity | null
}>

export class ExchangeOidcAuthorizationCode {
  constructor(
    private readonly c: SystemDatabaseContext & SystemClockContext & SystemOidcSigningContext,
  ) {}

  async prepare(
    props: PrepareProps,
  ): Promise<
    PreparedExchange | OidcInvalidGrantApplicationError | OidcTemporarilyUnavailableApplicationError
  > {
    const client = OidcClientPolicy.resolve(
      {
        issuer: props.issuer,
        clientId: props.clientId,
        redirectUri: props.redirectUri,
      },
      props.clientRegistry,
    )

    if (client === null) {
      return new OidcInvalidGrantApplicationError()
    }

    const signingKeys = OidcSigningKeyService.parse(this.c.env.OIDC_SIGNING_KEYS)

    if (signingKeys instanceof Error) {
      return new OidcTemporarilyUnavailableApplicationError(signingKeys)
    }

    const authorizationCode = await new OidcAuthorizationCodeRepository(this.c).write(
      WriteOperationEntity.create("consume", {
        issuer: props.issuer,
        clientId: client.id,
        redirectUri: props.redirectUri,
        code: props.code,
        verifier: props.codeVerifier,
      }),
    )

    if (authorizationCode instanceof Error) {
      return new OidcTemporarilyUnavailableApplicationError(authorizationCode)
    }

    if (authorizationCode === null) {
      return new OidcInvalidGrantApplicationError()
    }

    const scope = OidcScopeValue.parse(authorizationCode.scope)

    if (scope instanceof Error) {
      return new OidcInvalidGrantApplicationError(scope)
    }

    return {
      clientId: client.id,
      signingKeys,
      authorizationCode: {
        userId: authorizationCode.userId,
        nonce: authorizationCode.nonce,
      },
      scope,
    }
  }

  async execute(props: Props) {
    if (props.identity === null) {
      return new OidcInvalidGrantApplicationError()
    }

    const idToken = await new OidcIdTokenService(this.c).create({
      keys: props.prepared.signingKeys,
      issuer: props.issuer,
      clientId: props.prepared.clientId,
      identity: props.identity,
      nonce: props.prepared.authorizationCode.nonce,
      scope: props.prepared.scope,
    })

    if (idToken instanceof Error) {
      return new OidcTemporarilyUnavailableApplicationError(idToken)
    }

    const accessToken = await new OidcAccessTokenRepository(this.c).write(
      WriteOperationEntity.create("create", {
        issuer: props.issuer,
        clientId: props.prepared.clientId,
        userId: props.prepared.authorizationCode.userId,
        scope: props.prepared.scope.join(" "),
      }),
    )

    if (accessToken instanceof Error) {
      return new OidcTemporarilyUnavailableApplicationError(accessToken)
    }

    await new AuthAuditLogRepository(this.c).write(
      WriteOperationEntity.create("record", {
        userId: props.prepared.authorizationCode.userId,
        role: "identity",
        action: "login:oidc",
        resourceId: props.prepared.authorizationCode.userId,
        metadata: {
          issuer: props.issuer,
          clientId: props.prepared.clientId,
          scope: props.prepared.scope.join(" "),
        },
      }),
    )

    return {
      access_token: accessToken.accessToken,
      token_type: "Bearer" as const,
      expires_in: OidcValue.TOKEN_MAX_AGE_SECONDS,
      id_token: idToken,
      scope: props.prepared.scope.join(" "),
    }
  }
}
