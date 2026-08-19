/** /system/v1/browser-sessions */
import { toStableSystemAuditJson } from "@system/domain/audit/to-stable-system-audit-json"
import { consumeSystemBrowserLoginCode } from "@system/infrastructure/auth/consume-system-browser-login-code"
import { systemLoginCodeHash } from "@system/infrastructure/auth/system-login-code-hash"
import { SystemAccountRepository } from "@system/infrastructure/auth/system-account-repository"
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
      return context.json(
        { error: "browser login is unavailable", code: "browser_login_code_unavailable" },
        503,
      )
    }

    const codeHash = await systemLoginCodeHash(context.req.valid("json").code)
    if (codeHash instanceof Error) {
      return context.json(
        { error: "browser login is unavailable", code: "browser_login_code_unavailable" },
        503,
      )
    }
    const consumed = await consumeSystemBrowserLoginCode(
      { env: { DB: context.env.DB } },
      codeHash,
      now,
    )
    if (consumed instanceof Error) {
      return context.json(
        { error: "browser login is unavailable", code: "browser_login_code_unavailable" },
        503,
      )
    }
    if (consumed === null) {
      return context.json({ error: "invalid or expired code", code: "invalid_login_code" }, 401)
    }

    const account = await new SystemAccountRepository({ database: context.env.DB }).findById(
      consumed.accountId,
    )
    if (account instanceof Error) {
      return context.json(
        { error: "browser login is unavailable", code: "browser_login_code_unavailable" },
        503,
      )
    }
    if (account === null || account.status !== "active") {
      return context.json({ error: "invalid or expired code", code: "invalid_login_code" }, 401)
    }

    const sessionTtlMilliseconds = Number(context.env.SYSTEM_SESSION_TTL_SECONDS ?? 604_800) * 1_000
    const applications = createSystemSessionApplications({
      context: { env: { DB: context.env.DB } },
      jwtSecret: context.env.JWT_SECRET ?? "",
      sessionTtlMilliseconds,
    })
    const metadataJson = toStableSystemAuditJson({ transport: "system.v1.browser-sessions" })
    if (applications instanceof Error || metadataJson instanceof Error) {
      return context.json(
        { error: "browser login is unavailable", code: "browser_login_code_unavailable" },
        503,
      )
    }

    const issuance = await applications.issue.execute({
      accountId: account.id,
      tokenVersion: account.tokenVersion,
      now,
      auditContext: { authorizationJson: null, metadataJson },
    })
    if (issuance instanceof Error) {
      return context.json(
        { error: "browser login is unavailable", code: "browser_login_code_unavailable" },
        503,
      )
    }
    if (issuance.kind === "rejected") {
      return context.json({ error: "invalid or expired code", code: "invalid_login_code" }, 401)
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
