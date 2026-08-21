import {
  SystemBrowserLoginCodeUnavailableError,
  SystemLoginCodeInvalidError,
} from "@system/interface/errors"
/** /system/v1/browser-sessions */
import { StableSystemAuditJsonValue } from "@system/domain/values/stable-system-audit-json.value"
import { consumeSystemBrowserLoginCode } from "@system/infrastructure/auth/consume-system-browser-login-code.repository"
import { systemLoginCodeHash } from "@system/infrastructure/auth/system-login-code-hash.repository"
import { SystemAccountRepository } from "@system/infrastructure/auth/system-account.repository"
import { systemFactory } from "@system/interface/http/system-factory"
import { createSystemSessionApplications } from "@system/interface/runtime/create-system-session-applications"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization public - one-time code自体をcredentialとしてSystem Sessionへ交換する
export const POST = systemFactory.createHandlers(
  zValidator("json", z.object({ code: z.string().min(1).max(200) })),
  async (context) => {
    const now = context.var.now()
    if (!Number.isSafeInteger(now.getTime())) {
      throw new SystemBrowserLoginCodeUnavailableError()
    }

    const codeHash = await systemLoginCodeHash(context.req.valid("json").code)
    if (codeHash instanceof Error) {
      throw new SystemBrowserLoginCodeUnavailableError()
    }
    const consumed = await consumeSystemBrowserLoginCode(
      { env: { DB: context.env.DB } },
      codeHash,
      now,
    )
    if (consumed instanceof Error) {
      throw new SystemBrowserLoginCodeUnavailableError()
    }
    if (consumed === null) {
      throw new SystemLoginCodeInvalidError()
    }

    const account = await new SystemAccountRepository({ database: context.env.DB }).findById(
      consumed.accountId,
    )
    if (account instanceof Error) {
      throw new SystemBrowserLoginCodeUnavailableError()
    }
    if (account === null || account.status !== "active") {
      throw new SystemLoginCodeInvalidError()
    }

    const sessionTtlMilliseconds = Number(context.env.SYSTEM_SESSION_TTL_SECONDS ?? 604_800) * 1_000
    const applications = createSystemSessionApplications({
      context: { env: { DB: context.env.DB } },
      jwtSecret: context.env.JWT_SECRET ?? "",
      sessionTtlMilliseconds,
    })
    const metadataJson = StableSystemAuditJsonValue.create({
      transport: "system.v1.browser-sessions",
    })
    if (applications instanceof Error || metadataJson instanceof Error) {
      throw new SystemBrowserLoginCodeUnavailableError()
    }

    const issuance = await applications.issue.execute({
      accountId: account.id,
      tokenVersion: account.tokenVersion,
      now,
      auditContext: { authorizationJson: null, metadataJson: metadataJson?.toString() ?? null },
    })
    if (issuance instanceof Error) {
      throw new SystemBrowserLoginCodeUnavailableError()
    }
    if (issuance.kind === "rejected") {
      throw new SystemLoginCodeInvalidError()
    }

    return context.json(
      {
        account_id: issuance.accountId,
        access_token: issuance.accessToken,
        refresh_token: issuance.rawToken,
        session_id: issuance.sessionId,
        expires_at: issuance.expiresAt.toISOString(),
      },
      201,
    )
  },
)
