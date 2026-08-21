import {
  OidcInvalidTokenApplicationError,
  OidcTemporarilyUnavailableApplicationError,
} from "@/contexts/system/application/auth/errors"
import { OidcScopeValue } from "@system/domain/identity/oidc-scope.value"
import { findOidcAccessToken } from "@system/infrastructure/identity/find-oidc-access-token.repository"
import { SystemOidcIdentityRepository } from "@system/infrastructure/identity/system-oidc-identity.repository"
import { OidcValue } from "@/contexts/system/domain/identity/oidc.value"
import { readOidcAccessToken } from "@system/interface/lib/authorization/oidc-access-token"
import { OidcHttpError } from "@/contexts/system/interface/http/errors/oidc-http-error"
import { systemFactory } from "@/contexts/system/interface/http/system-factory"

// @authorization public - OIDC access token自体をcredentialとして検証する
export const GET = systemFactory.createHandlers(async (c) => {
  const accessToken = readOidcAccessToken(c.req.header("Authorization") ?? null)
  const issuer = OidcValue.issuer(
    {
      requestUrl: c.req.url,
      forwardedHost: c.req.header("X-Forwarded-Host") ?? null,
    },
    c.var.oidcIssuerConfiguration,
  )

  if (accessToken === null || issuer instanceof Error) {
    throw new OidcHttpError({
      code: "invalid_token",
      status: 401,
      authenticate: 'Bearer error="invalid_token"',
      cause: issuer instanceof Error ? issuer : undefined,
    })
  }

  const foundAccessToken = await findOidcAccessToken(c, { issuer, accessToken })

  const result = await (async () => {
    if (foundAccessToken instanceof Error) {
      return new OidcTemporarilyUnavailableApplicationError(foundAccessToken)
    }
    if (foundAccessToken === null) return new OidcInvalidTokenApplicationError()

    const scope = OidcScopeValue.parse(foundAccessToken.scope)
    if (scope instanceof Error) return new OidcInvalidTokenApplicationError(scope)

    const identity = await new SystemOidcIdentityRepository(c).findByAccountId(
      foundAccessToken.accountId,
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
  })()

  if (result instanceof OidcInvalidTokenApplicationError) {
    throw new OidcHttpError({
      code: "invalid_token",
      status: 401,
      authenticate: 'Bearer error="invalid_token"',
      cause: result,
    })
  }

  if (result instanceof OidcTemporarilyUnavailableApplicationError) {
    throw new OidcHttpError({
      code: "temporarily_unavailable",
      status: 503,
      cause: result,
    })
  }

  return c.json(result, 200, {
    "Cache-Control": "no-store",
    Pragma: "no-cache",
  })
})
