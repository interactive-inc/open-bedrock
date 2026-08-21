import {
  SystemIdentityLoginDeniedError,
  SystemIdentityLoginUnavailableError,
} from "@system/interface/errors"
/** /system/v1/identity-sessions */
import { systemFactory } from "@system/interface/http/system-factory"
import { IssueSystemIdentitySession } from "@system/application/auth/issue-system-identity-session"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization public - 外部Identity token自体をcredentialとしてSystem Sessionへ交換する
export const POST = systemFactory.createHandlers(
  zValidator("json", z.object({ token: z.string().min(1).max(4_096) })),
  async (context) => {
    const issuer = context.env.IDENTITY_ISSUER
    const audience = context.env.IDENTITY_AUDIENCE
    if (
      issuer === undefined ||
      issuer.length === 0 ||
      audience === undefined ||
      audience.length === 0
    ) {
      throw new SystemIdentityLoginUnavailableError()
    }

    const result = await new IssueSystemIdentitySession({
      database: context.env.DB,
      jwtSecret: context.env.JWT_SECRET ?? "",
      identityJwks: context.env.IDENTITY_JWKS,
      identityIssuer: issuer,
      identityAudience: audience,
      sessionTtlMilliseconds: Number(context.env.SYSTEM_SESSION_TTL_SECONDS ?? 604_800) * 1_000,
    }).issue(context.req.valid("json").token, context.var.now())
    if (result.kind === "unavailable") {
      throw new SystemIdentityLoginUnavailableError()
    }
    if (result.kind === "rejected") {
      throw new SystemIdentityLoginDeniedError()
    }

    return context.json(
      {
        account_id: result.accountId,
        access_token: result.accessToken,
        refresh_token: result.refreshToken,
        session_id: result.sessionId,
        expires_at: result.expiresAt.toISOString(),
      },
      201,
    )
  },
)
