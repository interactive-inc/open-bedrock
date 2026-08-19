import {
  OidcInvalidTokenApplicationError,
  OidcTemporarilyUnavailableApplicationError,
} from "@/contexts/system/application/auth/errors"
import { OidcAccessTokenRepository } from "@/contexts/system/infrastructure/identity/oidc-access-token.repository"
import type { OidcIdentity } from "@/contexts/system/infrastructure/identity/oidc-id-token.service"
import { OidcScopeValue } from "@system/domain/identity/oidc-scope.value"
import type {
  SystemClockContext,
  SystemDatabaseContext,
} from "@system/infrastructure/configuration/system-context"

type PrepareProps = Readonly<{ issuer: string; accessToken: string }>
type PreparedUserinfo = Readonly<{
  userId: string
  scope: ReadonlyArray<string>
}>
type Props = Readonly<{ prepared: PreparedUserinfo; identity: OidcIdentity | null }>

export class GetOidcUserinfo {
  constructor(private readonly c: SystemDatabaseContext & SystemClockContext) {}

  async prepare(
    props: PrepareProps,
  ): Promise<
    PreparedUserinfo | OidcInvalidTokenApplicationError | OidcTemporarilyUnavailableApplicationError
  > {
    const accessToken = await new OidcAccessTokenRepository(this.c).find({
      issuer: props.issuer,
      accessToken: props.accessToken,
    })

    if (accessToken instanceof Error) {
      return new OidcTemporarilyUnavailableApplicationError(accessToken)
    }

    if (accessToken === null) {
      return new OidcInvalidTokenApplicationError()
    }

    const scope = OidcScopeValue.parse(accessToken.scope)

    if (scope instanceof Error) {
      return new OidcInvalidTokenApplicationError(scope)
    }

    return { userId: accessToken.userId, scope }
  }

  execute(props: Props) {
    if (props.identity === null) {
      return new OidcInvalidTokenApplicationError()
    }

    return {
      sub: props.identity.subject,
      ...(props.prepared.scope.includes("profile") ? { name: props.identity.name } : {}),
      ...(props.prepared.scope.includes("email") && props.identity.email !== null
        ? { email: props.identity.email, email_verified: props.identity.emailVerified }
        : {}),
    }
  }
}
