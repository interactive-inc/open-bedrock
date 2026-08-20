import {
  OidcInvalidTokenApplicationError,
  OidcTemporarilyUnavailableApplicationError,
} from "@/contexts/system/application/auth/errors"
import { GetOidcUserinfo } from "@/contexts/system/application/auth/get-oidc-userinfo"
import { OidcValue } from "@/contexts/system/domain/identity/oidc.value"
import { OidcInvalidTokenError, OidcTemporarilyUnavailableError } from "@system/interface/errors"
import { systemFactory } from "@/contexts/system/interface/http/system-factory"

// @authorization public - OIDC access token自体をcredentialとして検証する
export const GET = systemFactory.createHandlers(async (c) => {
  const accessToken = OidcValue.accessTokenFromAuthorizationHeader(
    c.req.header("Authorization") ?? null,
  )
  const issuer = OidcValue.issuer(
    {
      requestUrl: c.req.url,
      forwardedHost: c.req.header("X-Forwarded-Host") ?? null,
    },
    c.var.oidcIssuerConfiguration,
  )

  if (accessToken === null || issuer instanceof Error) {
    throw new OidcInvalidTokenError({ cause: issuer instanceof Error ? issuer : undefined })
  }

  const service = new GetOidcUserinfo(c)
  const result = await service.execute({ issuer, accessToken })

  if (result instanceof OidcInvalidTokenApplicationError) {
    throw new OidcInvalidTokenError({ cause: result })
  }

  if (result instanceof OidcTemporarilyUnavailableApplicationError) {
    throw new OidcTemporarilyUnavailableError({ cause: result })
  }

  return c.json(result, 200, {
    "Cache-Control": "no-store",
    Pragma: "no-cache",
  })
})
