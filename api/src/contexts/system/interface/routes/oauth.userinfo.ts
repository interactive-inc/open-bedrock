import {
  OidcInvalidTokenApplicationError,
  OidcTemporarilyUnavailableApplicationError,
} from "@/contexts/system/application/auth/errors"
import { GetOidcUserinfo } from "@/contexts/system/application/auth/get-oidc-userinfo"
import { OidcValue } from "@/contexts/system/domain/identity/oidc.value"
import { OidcResponse } from "@/contexts/system/interface/http/oidc-response"
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
    const response = OidcResponse.error("invalid_token", 401)
    response.headers.set("WWW-Authenticate", 'Bearer error="invalid_token"')
    return response
  }

  const service = new GetOidcUserinfo(c)
  const result = await service.execute({ issuer, accessToken })

  if (result instanceof OidcInvalidTokenApplicationError) {
    const response = OidcResponse.error("invalid_token", 401)

    response.headers.set("WWW-Authenticate", 'Bearer error="invalid_token"')

    return response
  }

  if (result instanceof OidcTemporarilyUnavailableApplicationError) {
    return OidcResponse.error("temporarily_unavailable", 503)
  }

  return OidcResponse.json(result)
})
