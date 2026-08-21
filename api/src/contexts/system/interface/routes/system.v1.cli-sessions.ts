import { SystemHttpError } from "@system/interface/http/errors/system-http-error"
/** /system/v1/cli-sessions */
import { toStableSystemAuditJson } from "@system/domain/audit/to-stable-system-audit-json"
import { validateSystemAccessTokenSecret } from "@system/domain/auth/validate-system-access-token-secret"
import { consumeSystemCliLoginCode } from "@system/infrastructure/auth/consume-system-cli-login-code.repository"
import { SystemAccountRepository } from "@system/infrastructure/auth/system-account.repository"
import { systemLoginCodeHash } from "@system/infrastructure/auth/system-login-code-hash.repository"
import { systemFactory } from "@system/interface/http/system-factory"
import { createSystemSessionApplications } from "@system/interface/runtime/create-system-session-applications"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization public - one-time CLI codeをcredentialとしてSystem Sessionへ交換する
export const POST = systemFactory.createHandlers(
  zValidator("json", z.object({ code: z.string().min(1).max(200) })),
  async (context) => {
    const now = context.var.now()
    const applications = createSystemSessionApplications({
      context,
      jwtSecret: context.env.JWT_SECRET ?? "",
      sessionTtlMilliseconds: Number(context.env.SYSTEM_SESSION_TTL_SECONDS ?? 604_800) * 1_000,
    })
    const metadataJson = toStableSystemAuditJson({ transport: "system.v1.cli-sessions" })
    if (
      applications instanceof Error ||
      metadataJson instanceof Error ||
      validateSystemAccessTokenSecret(context.env.JWT_SECRET ?? "") !== null
    ) {
      throw new SystemHttpError({
        status: 503,
        code: "cli_login_unavailable",
        detail: "CLI login is unavailable",
      })
    }

    const codeHash = await systemLoginCodeHash(context.req.valid("json").code)
    if (codeHash instanceof Error) {
      throw new SystemHttpError({
        status: 503,
        code: "cli_login_unavailable",
        detail: "CLI login is unavailable",
      })
    }

    const consumed = await consumeSystemCliLoginCode(context, codeHash, now)
    if (consumed instanceof Error) {
      throw new SystemHttpError({
        status: 503,
        code: "cli_login_unavailable",
        detail: "CLI login is unavailable",
      })
    }
    if (consumed === null) {
      throw new SystemHttpError({
        status: 401,
        code: "invalid_cli_code",
        detail: "invalid CLI code",
      })
    }

    const account = await new SystemAccountRepository({ database: context.env.DB }).findById(
      consumed.accountId,
    )
    if (account instanceof Error) {
      throw new SystemHttpError({
        status: 503,
        code: "cli_login_unavailable",
        detail: "CLI login is unavailable",
      })
    }
    if (account === null || account.status !== "active") {
      throw new SystemHttpError({
        status: 401,
        code: "invalid_cli_code",
        detail: "invalid CLI code",
      })
    }
    const issued = await applications.issue.execute({
      accountId: account.id,
      tokenVersion: account.tokenVersion,
      now,
      auditContext: { authorizationJson: null, metadataJson },
    })
    if (issued instanceof Error) {
      throw new SystemHttpError({
        status: 503,
        code: "cli_login_unavailable",
        detail: "CLI login is unavailable",
      })
    }
    if (issued.kind === "rejected") {
      throw new SystemHttpError({
        status: 401,
        code: "invalid_cli_code",
        detail: "invalid CLI code",
      })
    }

    return context.json(
      {
        account_id: issued.accountId,
        access_token: issued.accessToken,
        refresh_token: issued.rawToken,
        session_id: issued.sessionId,
        expires_at: issued.expiresAt.toISOString(),
      },
      201,
    )
  },
)
