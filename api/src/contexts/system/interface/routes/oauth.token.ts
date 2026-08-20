import {
  OidcInvalidGrantApplicationError,
  OidcTemporarilyUnavailableApplicationError,
} from "@/contexts/system/application/auth/errors"
import { ExchangeOidcAuthorizationCode } from "@/contexts/system/application/auth/exchange-oidc-authorization-code"
import { OidcValue } from "@/contexts/system/domain/identity/oidc.value"
import { OidcHttpError } from "@/contexts/system/interface/http/errors/oidc-http-error"
import { systemFactory } from "@/contexts/system/interface/http/system-factory"
import { zValidator } from "@hono/zod-validator"
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
        throw new OidcHttpError({
          code: "invalid_request",
          cause: result.error,
        })
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
      throw new OidcHttpError({ code: "invalid_grant", cause: issuer })
    }

    const service = new ExchangeOidcAuthorizationCode(c)
    const result = await service.execute({
      issuer,
      code: body.code,
      clientId: body.client_id,
      redirectUri: body.redirect_uri,
      codeVerifier: body.code_verifier,
      clientRegistry: c.var.oidcClientRegistry,
    })

    if (result instanceof OidcInvalidGrantApplicationError) {
      throw new OidcHttpError({ code: "invalid_grant", cause: result })
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
  },
)
