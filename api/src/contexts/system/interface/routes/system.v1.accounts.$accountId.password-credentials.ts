/** /system/v1/accounts/:accountId/password-credentials */
import { zAccountId } from "@system/domain/auth/account-id"
import { validateSystemPassword } from "@system/domain/auth/system-password-policy"
import { createSystemAuditEvent } from "@system/domain/audit/create-system-audit-event"
import { toStableSystemAuditJson } from "@system/domain/audit/to-stable-system-audit-json"
import { SystemAuditEventRepository } from "@system/infrastructure/audit/system-audit-event-repository"
import { PasswordHashService } from "@system/infrastructure/auth/password-hash.service"
import { SystemPasswordAdministrationRepository } from "@system/infrastructure/auth/system-password-administration-repository"
import { authenticateSystemSession } from "@system/interface/http/authenticate-system-session"
import { systemFactory } from "@system/interface/http/system-factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization permission iam:write - credential変更・token失効・監査を同じtransactionで確定する
export const PATCH = systemFactory.createHandlers(
  authenticateSystemSession,
  zValidator("json", z.object({ password: z.string().min(12).max(200) }).strict()),
  async (context) => {
    if (!context.var.permissions.has("system:admin") && !context.var.permissions.has("iam:write")) {
      return context.json({ error: "forbidden", code: "forbidden" }, 403)
    }
    const actorAccountId = zAccountId.safeParse(context.var.userId)
    const targetAccountId = zAccountId.safeParse(context.req.param("accountId"))
    if (!actorAccountId.success) {
      return context.json({ error: "invalid session", code: "invalid_session" }, 401)
    }
    if (!targetAccountId.success) {
      return context.json(
        { error: "password credential not found", code: "password_credential_not_found" },
        404,
      )
    }
    const body = context.req.valid("json")
    if (validateSystemPassword(body.password) !== null) {
      return context.json({ error: "invalid password", code: "invalid_password" }, 400)
    }
    const pepper = context.env.PEPPER_SECRET
    if (pepper === undefined || pepper.length === 0) {
      return context.json(
        { error: "password service unavailable", code: "password_unavailable" },
        503,
      )
    }
    const repository = new SystemPasswordAdministrationRepository({
      env: { DB: context.env.DB },
    })
    const identityId = await repository.findIdentityId(targetAccountId.data)
    if (identityId instanceof Error) {
      return context.json(
        { error: "password service unavailable", code: "password_unavailable" },
        503,
      )
    }
    if (identityId === null) {
      return context.json(
        { error: "password credential not found", code: "password_credential_not_found" },
        404,
      )
    }
    const passwordHash = await PasswordHashService.hash(body.password, pepper).catch(
      (caught: unknown) =>
        caught instanceof Error ? caught : new Error("failed to hash System password"),
    )
    if (passwordHash instanceof Error) {
      console.error(
        JSON.stringify({ event: "system_password_reset_hash_failed", error: passwordHash.name }),
      )
      return context.json(
        { error: "password service unavailable", code: "password_unavailable" },
        503,
      )
    }
    const now = context.var.now()
    if (!Number.isSafeInteger(now.getTime())) {
      return context.json(
        { error: "password service unavailable", code: "password_unavailable" },
        503,
      )
    }
    const afterJson = toStableSystemAuditJson({ changed_at: now.toISOString() })
    if (afterJson instanceof Error) {
      return context.json(
        { error: "password service unavailable", code: "password_unavailable" },
        503,
      )
    }
    const auditEvent = createSystemAuditEvent({
      actorAccountId: actorAccountId.data,
      action: "system.password_credential.reset",
      targetType: "system:identity",
      targetId: identityId,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: null,
      beforeJson: null,
      afterJson,
      metadataJson: null,
      occurredAt: now,
    })
    if (auditEvent instanceof Error) {
      return context.json(
        { error: "password service unavailable", code: "password_unavailable" },
        503,
      )
    }
    const auditStatements = new SystemAuditEventRepository({
      env: { DB: context.env.DB },
    }).prepareAppend(auditEvent)
    const reset = await repository.reset({
      actorAccountId: actorAccountId.data,
      targetAccountId: targetAccountId.data,
      identityId,
      passwordHash,
      now,
      auditStatements,
    })
    if (reset instanceof Error) {
      return context.json(
        { error: "password service unavailable", code: "password_unavailable" },
        503,
      )
    }
    if (reset === "forbidden") {
      return context.json({ error: "forbidden", code: "forbidden" }, 403)
    }
    if (reset === "not_found") {
      return context.json(
        { error: "password credential not found", code: "password_credential_not_found" },
        404,
      )
    }

    return context.body(null, 204)
  },
)
