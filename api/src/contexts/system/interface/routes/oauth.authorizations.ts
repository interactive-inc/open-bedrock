import { CreateOidcAuthorization } from "@/contexts/system/application/auth/create-oidc-authorization"
import {
  OidcInvalidRequestApplicationError,
  OidcInvalidScopeApplicationError,
  OidcTemporarilyUnavailableApplicationError,
} from "@/contexts/system/application/auth/errors"
import { OidcValue } from "@/contexts/system/domain/identity/oidc.value"
import { OidcHttpError } from "@/contexts/system/interface/http/errors/oidc-http-error"
import { requireSystemAuthentication } from "@system/interface/http/require-system-authentication"
import { systemFactory } from "@/contexts/system/interface/http/system-factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { zAppOidcAuthorizationResponse } from "@/contexts/system/interface/models/auth"

/**
 * 認証済みSystem Accountの同意後に認可コードを発行する内部API。
 *
 * userIdはbodyから受け取らず、製品compositionが検証済みのセッション本人だけを使う。
 * client/redirect URIは静的registryで完全一致させ、codeはhashのみD1へ保存する。
 */
// @authorization authenticated - 検証済みSystem Account本人の同意だけを受け付ける
export const POST = systemFactory.createHandlers(
  requireSystemAuthentication,
  zValidator(
    "json",
    z.strictObject({
      decision: z.enum(["allow", "deny"]),
      responseType: z.literal("code"),
      clientId: z.string().regex(/^[A-Za-z0-9._~-]{1,128}$/),
      redirectUri: z.url().max(2048),
      scope: z.string().min(1).max(256),
      state: z.string().min(16).max(512),
      nonce: z.string().min(16).max(512),
      codeChallenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
      codeChallengeMethod: z.literal("S256"),
    }),
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
    const body = c.req.valid("json")
    const issuer = OidcValue.issuer(
      {
        requestUrl: c.req.url,
        forwardedHost: c.req.header("X-Forwarded-Host") ?? null,
      },
      c.var.oidcIssuerConfiguration,
    )

    if (issuer instanceof Error) {
      throw new OidcHttpError({ code: "invalid_request", cause: issuer })
    }

    const service = new CreateOidcAuthorization(c)

    const result = await service.execute({
      issuer,
      ...body,
      clientRegistry: c.var.oidcClientRegistry,
    })

    if (result instanceof OidcInvalidRequestApplicationError) {
      throw new OidcHttpError({ code: "invalid_request", cause: result })
    }

    if (result instanceof OidcInvalidScopeApplicationError) {
      throw new OidcHttpError({ code: "invalid_scope", cause: result })
    }

    if (result instanceof OidcTemporarilyUnavailableApplicationError) {
      throw new OidcHttpError({
        code: "temporarily_unavailable",
        status: 503,
        cause: result,
      })
    }

    return c.json(zAppOidcAuthorizationResponse.parse(result), 200, {
      "Cache-Control": "no-store",
      Pragma: "no-cache",
    })
  },
)
