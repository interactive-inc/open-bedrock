import {
  SystemCLIAuthorizationInvalidError,
  SystemCLILoginUnavailableError,
} from "@system/interface/errors"
/** /system/v1/cli-authorization-callback */
import { SystemCliIdentityRedirectUriValue } from "@system/domain/values/system-cli-identity-redirect-uri.value"
import { SystemCliLoginAuditRecorder } from "@system/infrastructure/audit/system-cli-login-audit-recorder.repository"
import { consumeSystemCliLoginState } from "@system/infrastructure/auth/consume-system-cli-login-state.repository"
import { createSystemCliLoginCode } from "@system/infrastructure/auth/create-system-cli-login-code.repository"
import { exchangeSystemIdentityCode } from "@system/infrastructure/auth/exchange-system-identity-code.repository"
import { recordSystemIdentityLoginToken } from "@system/infrastructure/auth/record-system-identity-login-token.repository"
import { SystemIdentityLoginRepository } from "@system/infrastructure/auth/system-identity-login.repository"
import { SystemIdentityTokenVerifier } from "@system/infrastructure/auth/system-identity-token-verifier.repository"
import { SystemIdentityVerificationKeyResolver } from "@system/infrastructure/auth/system-identity-verification-key-resolver.repository"
import { systemLoginCodeHash } from "@system/infrastructure/auth/system-login-code-hash.repository"
import { systemFactory } from "@system/interface/http/system-factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization public - 外部Identity providerからCLI authorizationを完了する
export const GET = systemFactory.createHandlers(
  zValidator(
    "query",
    z.object({
      code: z.string().min(1).max(512).optional(),
      state: z.string().min(1).max(512).optional(),
      error: z.string().min(1).max(200).optional(),
    }),
  ),
  async (context) => {
    const now = context.var.now()
    const query = context.req.valid("query")
    if (query.state === undefined) {
      throw new SystemCLIAuthorizationInvalidError()
    }

    const consumed = await consumeSystemCliLoginState(context, query.state, now)
    if (consumed instanceof Error) {
      throw new SystemCLILoginUnavailableError()
    }
    if (consumed === null) {
      throw new SystemCLIAuthorizationInvalidError()
    }

    const loopbackUrl = new URL(`http://127.0.0.1:${consumed.port}/callback`)
    loopbackUrl.searchParams.set("state", consumed.cliState)
    if (query.error !== undefined || query.code === undefined) {
      const reason = query.error === undefined ? "missing_code" : "identity_provider_denied"
      const audited = await new SystemCliLoginAuditRecorder(context).recordDenied(reason, now)
      loopbackUrl.searchParams.set(
        "error",
        audited instanceof Error ? "audit_unavailable" : "identity_login_denied",
      )
      return context.redirect(loopbackUrl.toString(), 302)
    }

    const issuer = context.env.IDENTITY_ISSUER
    const apiOrigin = context.env.API_ORIGIN
    const redirectUri =
      apiOrigin === undefined
        ? new Error("API origin is not configured")
        : SystemCliIdentityRedirectUriValue.create(apiOrigin)
    const verificationKey =
      issuer === undefined || issuer.length === 0
        ? new Error("identity issuer is not configured")
        : new SystemIdentityVerificationKeyResolver({
            jwks: context.env.IDENTITY_JWKS,
            issuer,
          }).resolve()
    if (
      issuer === undefined ||
      issuer.length === 0 ||
      redirectUri instanceof Error ||
      verificationKey instanceof Error
    ) {
      loopbackUrl.searchParams.set("error", "cli_login_unavailable")
      return context.redirect(loopbackUrl.toString(), 302)
    }

    const token = await exchangeSystemIdentityCode({
      code: query.code,
      codeVerifier: consumed.codeVerifier,
      redirectUri: redirectUri.toString(),
      issuer,
    })
    if (token instanceof Error) {
      const audited = await new SystemCliLoginAuditRecorder(context).recordDenied(
        "invalid_token",
        now,
      )
      loopbackUrl.searchParams.set(
        "error",
        audited instanceof Error ? "audit_unavailable" : "identity_login_denied",
      )
      return context.redirect(loopbackUrl.toString(), 302)
    }

    const claims = await new SystemIdentityTokenVerifier().verify({
      token,
      verificationKey,
      issuer,
      audience: new URL(redirectUri.toString()).origin,
      now,
    })
    if ("reason" in claims || claims.email_verified !== true) {
      const reason = "reason" in claims ? "invalid_token" : "email_unverified"
      const audited = await new SystemCliLoginAuditRecorder(context).recordDenied(reason, now)
      loopbackUrl.searchParams.set(
        "error",
        audited instanceof Error ? "audit_unavailable" : "identity_login_denied",
      )
      return context.redirect(loopbackUrl.toString(), 302)
    }

    const marked = await recordSystemIdentityLoginToken(context, {
      jti: claims.jti,
      expiresAt: new Date(claims.exp * 1_000),
      usedAt: now,
    })
    if (marked instanceof Error) {
      loopbackUrl.searchParams.set("error", "cli_login_unavailable")
      return context.redirect(loopbackUrl.toString(), 302)
    }
    if (marked === "replayed") {
      const audited = await new SystemCliLoginAuditRecorder(context).recordDenied(
        "token_replayed",
        now,
      )
      loopbackUrl.searchParams.set(
        "error",
        audited instanceof Error ? "audit_unavailable" : "identity_login_denied",
      )
      return context.redirect(loopbackUrl.toString(), 302)
    }

    const login = await new SystemIdentityLoginRepository(context).find("oidc", claims.sub)
    if (login instanceof Error) {
      loopbackUrl.searchParams.set("error", "cli_login_unavailable")
      return context.redirect(loopbackUrl.toString(), 302)
    }
    if (login === null || login.account.status !== "active") {
      const reason = login === null ? "account_not_found" : "account_inactive"
      const audited = await new SystemCliLoginAuditRecorder(context).recordDenied(reason, now)
      loopbackUrl.searchParams.set(
        "error",
        audited instanceof Error ? "audit_unavailable" : "identity_login_denied",
      )
      return context.redirect(loopbackUrl.toString(), 302)
    }

    const rawCode = crypto.randomUUID()
    const codeHash = await systemLoginCodeHash(rawCode)
    if (codeHash instanceof Error) {
      loopbackUrl.searchParams.set("error", "cli_login_unavailable")
      return context.redirect(loopbackUrl.toString(), 302)
    }
    const codeCreated = await createSystemCliLoginCode(context, {
      codeHash,
      accountId: login.account.id,
      createdAt: now,
      expiresAt: new Date(now.getTime() + 60_000),
    })
    if (codeCreated instanceof Error) {
      loopbackUrl.searchParams.set("error", "cli_login_unavailable")
      return context.redirect(loopbackUrl.toString(), 302)
    }

    loopbackUrl.searchParams.set("code", rawCode)
    return context.redirect(loopbackUrl.toString(), 302)
  },
)
