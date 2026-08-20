import { SystemCliLoginUnavailableError, SystemInvalidCliCodeError } from "@system/interface/errors"
/** /system/v1/cli-sessions */
import { toStableSystemAuditJson } from "@system/domain/audit/to-stable-system-audit-json"
import { validateSystemAccessTokenSecret } from "@system/domain/auth/validate-system-access-token-secret"
import { consumeSystemCliLoginCode } from "@system/infrastructure/auth/consume-system-cli-login-code"
import { SystemAccountRepository } from "@system/infrastructure/auth/system-account-repository"
import { systemLoginCodeHash } from "@system/infrastructure/auth/system-login-code-hash"
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
      throw new SystemCliLoginUnavailableError()
    }

    const codeHash = await systemLoginCodeHash(context.req.valid("json").code)
    if (codeHash instanceof Error) {
      throw new SystemCliLoginUnavailableError()
    }

    const consumed = await consumeSystemCliLoginCode(context, codeHash, now)
    if (consumed instanceof Error) {
      throw new SystemCliLoginUnavailableError()
    }
    if (consumed === null) {
      throw new SystemInvalidCliCodeError()
    }

    const account = await new SystemAccountRepository({ database: context.env.DB }).findById(
      consumed.accountId,
    )
    if (account instanceof Error) {
      throw new SystemCliLoginUnavailableError()
    }
    if (account === null || account.status !== "active") {
      throw new SystemInvalidCliCodeError()
    }
    const issued = await applications.issue.execute({
      accountId: account.id,
      tokenVersion: account.tokenVersion,
      now,
      auditContext: { authorizationJson: null, metadataJson },
    })
    if (issued instanceof Error) {
      throw new SystemCliLoginUnavailableError()
    }
    if (issued.kind === "rejected") {
      throw new SystemInvalidCliCodeError()
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
