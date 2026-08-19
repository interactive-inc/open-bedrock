import {
  OidcInvalidRequestApplicationError,
  OidcInvalidScopeApplicationError,
  OidcTemporarilyUnavailableApplicationError,
} from "@/contexts/system/application/auth/errors"
import { AuthAuditLogRepository } from "@/contexts/system/infrastructure/audit/auth-audit-log.repository"
import { OidcAuthorizationCodeRepository } from "@/contexts/system/infrastructure/identity/oidc-authorization-code.repository"
import {
  OidcClientPolicy,
  type OidcClientRegistry,
} from "@system/domain/identity/oidc-client.policy"
import { OidcScopeValue } from "@system/domain/identity/oidc-scope.value"
import { WriteOperationEntity } from "@/lib/persistence/write-operation.entity"
import type {
  SystemAuthorizationContext,
  SystemClockContext,
  SystemDatabaseContext,
} from "@system/infrastructure/configuration/system-context"

type Props = Readonly<{
  issuer: string
  decision: "allow" | "deny"
  clientId: string
  redirectUri: string
  scope: string
  state: string
  nonce: string
  codeChallenge: string
  clientRegistry: OidcClientRegistry
}>

export class CreateOidcAuthorization {
  constructor(
    private readonly c: SystemDatabaseContext & SystemClockContext & SystemAuthorizationContext,
  ) {}

  async execute(props: Props) {
    const client = OidcClientPolicy.resolve(
      {
        issuer: props.issuer,
        clientId: props.clientId,
        redirectUri: props.redirectUri,
      },
      props.clientRegistry,
    )

    if (client === null) {
      return new OidcInvalidRequestApplicationError()
    }

    const scope = OidcScopeValue.parse(props.scope)

    if (scope instanceof Error) {
      return new OidcInvalidScopeApplicationError(scope)
    }

    const redirect = new URL(props.redirectUri)
    redirect.searchParams.set("state", props.state)
    redirect.searchParams.set("iss", props.issuer)

    if (props.decision === "deny") {
      redirect.searchParams.set("error", "access_denied")

      await this.recordAudit("oidc:deny", props.issuer, client.id, scope)

      return { redirect_uri: redirect.toString() }
    }

    const authorizationCode = await new OidcAuthorizationCodeRepository(this.c).write(
      WriteOperationEntity.create("create", {
        issuer: props.issuer,
        clientId: client.id,
        redirectUri: props.redirectUri,
        userId: this.c.var.userId,
        codeChallenge: props.codeChallenge,
        nonce: props.nonce,
        scope,
      }),
    )

    if (authorizationCode instanceof Error) {
      return new OidcTemporarilyUnavailableApplicationError(authorizationCode)
    }

    redirect.searchParams.set("code", authorizationCode.code)

    await this.recordAudit("oidc:authorize", props.issuer, client.id, scope)

    return { redirect_uri: redirect.toString() }
  }

  private async recordAudit(
    action: "oidc:deny" | "oidc:authorize",
    issuer: string,
    clientId: string,
    scope: ReadonlyArray<string>,
  ): Promise<void> {
    await new AuthAuditLogRepository(this.c).write(
      WriteOperationEntity.create("record", {
        userId: this.c.var.userId,
        role: this.c.var.role,
        action,
        resourceId: this.c.var.userId,
        metadata: { issuer, clientId, scope: scope.join(" ") },
      }),
    )
  }
}
