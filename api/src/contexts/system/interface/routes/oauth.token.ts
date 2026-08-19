import {
  OidcInvalidGrantApplicationError,
  OidcTemporarilyUnavailableApplicationError,
} from "@/contexts/system/application/auth/errors"
import { ExchangeOidcAuthorizationCode } from "@/contexts/system/application/auth/exchange-oidc-authorization-code"
import { OidcValue } from "@/contexts/system/domain/identity/oidc.value"
import { OidcResponse } from "@/contexts/system/interface/http/oidc-response"
import { systemFactory } from "@/contexts/system/interface/http/system-factory"
import { toOidcIdentity } from "@/contexts/system/interface/identity/to-oidc-identity"
import { userIdentities, users } from "@/contexts/system/infrastructure/schema/system-runtime"
import { zValidator } from "@hono/zod-validator"
import { desc, eq } from "drizzle-orm"
import { z } from "zod"

// @authorization public - authorization codeとPKCE verifierをcredentialとして検証する
export const POST = systemFactory.createHandlers(
  zValidator(
    "form",
    z
      .object({
        grant_type: z.literal("authorization_code"),
        code: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
        client_id: z.string().regex(/^[A-Za-z0-9._~-]{1,128}$/),
        redirect_uri: z.url().max(2048),
        code_verifier: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/),
      })
      .strict(),
    (result) => {
      if (!result.success) {
        return OidcResponse.error("invalid_request")
      }
    },
  ),
  async (c) => {
    const body = c.req.valid("form")
    const issuer = OidcValue.issuer(
      {
        requestUrl: c.req.url,
        forwardedHost: c.req.header("X-Forwarded-Host") ?? null,
      },
      c.var.oidcIssuerConfiguration,
    )

    if (issuer instanceof Error) {
      return OidcResponse.error("invalid_grant")
    }

    const service = new ExchangeOidcAuthorizationCode(c)

    const prepared = await service.prepare({
      issuer,
      code: body.code,
      clientId: body.client_id,
      redirectUri: body.redirect_uri,
      codeVerifier: body.code_verifier,
      clientRegistry: c.var.oidcClientRegistry,
    })

    if (prepared instanceof OidcInvalidGrantApplicationError) {
      return OidcResponse.error("invalid_grant")
    }

    if (prepared instanceof OidcTemporarilyUnavailableApplicationError) {
      return OidcResponse.error("temporarily_unavailable", 503)
    }

    const [userRows, identities] = await Promise.all([
      c.var.database
        .select({ id: users.id, disabledAt: users.disabledAt })
        .from(users)
        .where(eq(users.id, prepared.authorizationCode.userId))
        .limit(1),
      c.var.database
        .select({
          email: userIdentities.email,
          emailVerifiedAt: userIdentities.emailVerifiedAt,
        })
        .from(userIdentities)
        .where(eq(userIdentities.userId, prepared.authorizationCode.userId))
        .orderBy(desc(userIdentities.emailVerifiedAt)),
    ])
    const [user] = userRows
    const identity = toOidcIdentity(user, identities)

    const result = await service.execute({ issuer, prepared, identity })

    if (result instanceof OidcInvalidGrantApplicationError) {
      return OidcResponse.error("invalid_grant")
    }

    if (result instanceof OidcTemporarilyUnavailableApplicationError) {
      return OidcResponse.error("temporarily_unavailable", 503)
    }

    return OidcResponse.json(result)
  },
)
