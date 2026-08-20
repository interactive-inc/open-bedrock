import { SystemCliLoginUnavailableError } from "@system/interface/errors"
/** /system/v1/cli-authorizations */
import { isSecureSystemIdentityIssuer } from "@system/domain/identity/is-secure-system-identity-issuer"
import { systemCliIdentityRedirectUri } from "@system/domain/identity/system-cli-identity-redirect-uri"
import { createSystemCliLoginState } from "@system/infrastructure/auth/create-system-cli-login-state"
import { createSystemPkce } from "@system/infrastructure/auth/create-system-pkce"
import { systemFactory } from "@system/interface/http/system-factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization public - CLIが外部Identity providerで本人確認を始める
export const GET = systemFactory.createHandlers(
  zValidator(
    "query",
    z.object({
      port: z.coerce.number().int().min(1).max(65_535),
      state: z.string().min(1).max(512),
    }),
  ),
  async (context) => {
    const identityLoginUrl = context.env.IDENTITY_LOGIN_URL
    const apiOrigin = context.env.API_ORIGIN
    if (
      identityLoginUrl === undefined ||
      identityLoginUrl.length === 0 ||
      apiOrigin === undefined ||
      apiOrigin.length === 0
    ) {
      throw new SystemCliLoginUnavailableError()
    }

    if (!URL.canParse(identityLoginUrl)) {
      throw new SystemCliLoginUnavailableError()
    }
    const brokerUrl = new URL(identityLoginUrl)
    const redirectUri = systemCliIdentityRedirectUri(apiOrigin)
    if (
      !isSecureSystemIdentityIssuer(brokerUrl) ||
      brokerUrl.username !== "" ||
      brokerUrl.password !== "" ||
      brokerUrl.hash !== "" ||
      redirectUri instanceof Error
    ) {
      throw new SystemCliLoginUnavailableError()
    }

    const now = context.var.now()
    if (!Number.isSafeInteger(now.getTime())) {
      throw new SystemCliLoginUnavailableError()
    }
    const pkce = await createSystemPkce()
    const brokerState = crypto.randomUUID()
    const query = context.req.valid("query")
    const created = await createSystemCliLoginState(context, {
      state: brokerState,
      port: query.port,
      cliState: query.state,
      codeVerifier: pkce.verifier,
      createdAt: now,
      expiresAt: new Date(now.getTime() + 600_000),
    })
    if (created instanceof Error) {
      throw new SystemCliLoginUnavailableError()
    }

    brokerUrl.searchParams.set("callback", redirectUri)
    brokerUrl.searchParams.set("state", brokerState)
    brokerUrl.searchParams.set("code_challenge", pkce.challenge)
    brokerUrl.searchParams.set("code_challenge_method", "S256")

    return context.redirect(brokerUrl.toString(), 302)
  },
)
