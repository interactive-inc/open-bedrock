import {
  OidcInvalidTokenApplicationError,
  OidcTemporarilyUnavailableApplicationError,
} from "@system/application/auth/errors"
import { OidcScopeValue } from "@system/domain/identity/oidc-scope.value"
import type {
  SystemClockContext,
  SystemDatabaseContext,
} from "@system/infrastructure/configuration/system-context"
import { findOidcAccessToken } from "@system/infrastructure/identity/find-oidc-access-token"
import { SystemOidcIdentityRepository } from "@system/infrastructure/identity/system-oidc-identity-repository"

type Props = Readonly<{ issuer: string; accessToken: string }>

/** OIDC access tokenを検証し、active Accountの公開可能なclaimだけを返す。 */
export class GetOidcUserinfo {
  constructor(private readonly context: SystemDatabaseContext & SystemClockContext) {
    Object.freeze(this)
  }

  async execute(props: Props) {
    const accessToken = await findOidcAccessToken(this.context, props)
    if (accessToken instanceof Error) {
      return new OidcTemporarilyUnavailableApplicationError(accessToken)
    }
    if (accessToken === null) return new OidcInvalidTokenApplicationError()

    const scope = OidcScopeValue.parse(accessToken.scope)
    if (scope instanceof Error) return new OidcInvalidTokenApplicationError(scope)

    const identity = await new SystemOidcIdentityRepository(this.context).findByAccountId(
      accessToken.accountId,
    )
    if (identity instanceof Error) {
      return new OidcTemporarilyUnavailableApplicationError(identity)
    }
    if (identity === null) return new OidcInvalidTokenApplicationError()

    return {
      sub: identity.subject,
      ...(scope.includes("email") && identity.email !== null
        ? { email: identity.email, email_verified: identity.emailVerified }
        : {}),
    }
  }
}
