import {
  OidcInvalidTokenApplicationError,
  OidcTemporarilyUnavailableApplicationError,
} from "@/contexts/system/application/auth/errors"
import { GetOidcUserinfo } from "@/contexts/system/application/auth/get-oidc-userinfo"
import { OidcValue } from "@/contexts/system/domain/identity/oidc.value"
import { OidcResponse } from "@/contexts/system/interface/http/oidc-response"
import { systemFactory } from "@/contexts/system/interface/http/system-factory"
import { toOidcIdentity } from "@/contexts/system/interface/identity/to-oidc-identity"
import { userIdentities, users } from "@/contexts/system/infrastructure/schema/system-runtime"
import { desc, eq } from "drizzle-orm"

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
  const prepared = await service.prepare({ issuer, accessToken })

  if (prepared instanceof OidcInvalidTokenApplicationError) {
    const response = OidcResponse.error("invalid_token", 401)

    response.headers.set("WWW-Authenticate", 'Bearer error="invalid_token"')

    return response
  }

  if (prepared instanceof OidcTemporarilyUnavailableApplicationError) {
    return OidcResponse.error("temporarily_unavailable", 503)
  }

  const [userRows, identities] = await Promise.all([
    c.var.database
      .select({ id: users.id, disabledAt: users.disabledAt })
      .from(users)
      .where(eq(users.id, prepared.userId))
      .limit(1),
    c.var.database
      .select({
        email: userIdentities.email,
        emailVerifiedAt: userIdentities.emailVerifiedAt,
      })
      .from(userIdentities)
      .where(eq(userIdentities.userId, prepared.userId))
      .orderBy(desc(userIdentities.emailVerifiedAt)),
  ])
  const [user] = userRows
  const identity = toOidcIdentity(user, identities)

  const result = service.execute({ prepared, identity })

  if (result instanceof OidcInvalidTokenApplicationError) {
    const response = OidcResponse.error("invalid_token", 401)
    response.headers.set("WWW-Authenticate", 'Bearer error="invalid_token"')
    return response
  }

  return OidcResponse.json(result)
})
