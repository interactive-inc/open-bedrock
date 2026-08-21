import { SystemCLICodeInvalidError, SystemCLILoginUnavailableError } from "@system/interface/errors"
/** /system/v1/cli-sessions */
import { StableSystemAuditJsonValue } from "@system/domain/values/stable-system-audit-json.value"
import { SystemAccessTokenSecretValue } from "@system/domain/values/system-access-token-secret.value"
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
    const metadataJson = StableSystemAuditJsonValue.create({ transport: "system.v1.cli-sessions" })
    if (
      applications instanceof Error ||
      metadataJson instanceof Error ||
      !(
        SystemAccessTokenSecretValue.create(context.env.JWT_SECRET ?? "") instanceof
        SystemAccessTokenSecretValue
      )
    ) {
      throw new SystemCLILoginUnavailableError()
    }

    const codeHash = await systemLoginCodeHash(context.req.valid("json").code)
    if (codeHash instanceof Error) {
      throw new SystemCLILoginUnavailableError()
    }

    const consumed = await consumeSystemCliLoginCode(context, codeHash, now)
    if (consumed instanceof Error) {
      throw new SystemCLILoginUnavailableError()
    }
    if (consumed === null) {
      throw new SystemCLICodeInvalidError()
    }

    const account = await new SystemAccountRepository({ database: context.env.DB }).findById(
      consumed.accountId,
    )
    if (account instanceof Error) {
      throw new SystemCLILoginUnavailableError()
    }
    if (account === null || account.status !== "active") {
      throw new SystemCLICodeInvalidError()
    }
    const issued = await applications.issue.execute({
      accountId: account.id,
      tokenVersion: account.tokenVersion,
      now,
      auditContext: { authorizationJson: null, metadataJson: metadataJson?.toString() ?? null },
    })
    if (issued instanceof Error) {
      throw new SystemCLILoginUnavailableError()
    }
    if (issued.kind === "rejected") {
      throw new SystemCLICodeInvalidError()
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
