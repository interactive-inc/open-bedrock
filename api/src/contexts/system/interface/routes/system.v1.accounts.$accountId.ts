/** /system/v1/accounts/:accountId */
import { zAccountId } from "@system/domain/auth/account-id"
import { createSystemAuditEvent } from "@system/domain/audit/create-system-audit-event"
import { toStableSystemAuditJson } from "@system/domain/audit/to-stable-system-audit-json"
import { SystemAuditEventRepository } from "@system/infrastructure/audit/system-audit-event-repository"
import { SystemAccountAdministrationRepository } from "@system/infrastructure/iam/system-account-administration-repository"
import { authenticateSystemSession } from "@system/interface/http/authenticate-system-session"
import { systemFactory } from "@system/interface/http/system-factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization permission iam:read - 一つのSystem AccountをCompany情報なしで読む
export const GET = systemFactory.createHandlers(authenticateSystemSession, async (context) => {
  if (!context.var.permissions.has("system:admin") && !context.var.permissions.has("iam:read")) {
    return context.json({ error: "forbidden", code: "forbidden" }, 403)
  }
  const accountId = zAccountId.safeParse(context.req.param("accountId"))
  if (!accountId.success) {
    return context.json({ error: "account not found", code: "account_not_found" }, 404)
  }
  const account = await new SystemAccountAdministrationRepository({
    env: { DB: context.env.DB },
  }).findById(accountId.data)
  if (account instanceof Error) {
    return context.json({ error: "account service unavailable", code: "account_unavailable" }, 503)
  }
  if (account === null) {
    return context.json({ error: "account not found", code: "account_not_found" }, 404)
  }

  return context.json(
    {
      id: account.id,
      status: account.status,
      token_version: account.tokenVersion,
      role_keys: account.roleKeys,
      created_at: account.createdAt.toISOString(),
      updated_at: account.updatedAt.toISOString(),
    },
    200,
  )
})

// @authorization permission iam:write - live権限・自己停止・last-rootを同じ更新境界で検査する
export const PATCH = systemFactory.createHandlers(
  authenticateSystemSession,
  zValidator("json", z.object({ status: z.enum(["active", "suspended", "locked"]) }).strict()),
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
      return context.json({ error: "account not found", code: "account_not_found" }, 404)
    }

    const repository = new SystemAccountAdministrationRepository({ env: { DB: context.env.DB } })
    const before = await repository.findById(targetAccountId.data)
    if (before instanceof Error) {
      return context.json(
        { error: "account service unavailable", code: "account_unavailable" },
        503,
      )
    }
    if (before === null) {
      return context.json({ error: "account not found", code: "account_not_found" }, 404)
    }
    const body = context.req.valid("json")
    if (before.status === body.status) {
      return context.json(
        {
          id: before.id,
          status: before.status,
          token_version: before.tokenVersion,
          role_keys: before.roleKeys,
          created_at: before.createdAt.toISOString(),
          updated_at: before.updatedAt.toISOString(),
        },
        200,
      )
    }
    const now = context.var.now()
    if (!Number.isSafeInteger(now.getTime())) {
      return context.json(
        { error: "account service unavailable", code: "account_unavailable" },
        503,
      )
    }
    const beforeJson = toStableSystemAuditJson({
      status: before.status,
      token_version: before.tokenVersion,
    })
    const afterJson = toStableSystemAuditJson({
      status: body.status,
      token_version: before.tokenVersion + 1,
    })
    if (beforeJson instanceof Error || afterJson instanceof Error) {
      return context.json(
        { error: "account service unavailable", code: "account_unavailable" },
        503,
      )
    }
    const auditEvent = createSystemAuditEvent({
      actorAccountId: actorAccountId.data,
      action: "system.account.status_updated",
      targetType: "system:account",
      targetId: targetAccountId.data,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: null,
      beforeJson,
      afterJson,
      metadataJson: null,
      occurredAt: now,
    })
    if (auditEvent instanceof Error) {
      return context.json(
        { error: "account service unavailable", code: "account_unavailable" },
        503,
      )
    }
    const auditStatements = new SystemAuditEventRepository({
      env: { DB: context.env.DB },
    }).prepareAppend(auditEvent)
    const update = await repository.setStatus(
      actorAccountId.data,
      targetAccountId.data,
      body.status,
      now,
      auditStatements,
    )
    if (update instanceof Error) {
      return context.json(
        { error: "account service unavailable", code: "account_unavailable" },
        503,
      )
    }
    if (update === "not_found") {
      return context.json({ error: "account not found", code: "account_not_found" }, 404)
    }
    if (update === "forbidden") {
      return context.json({ error: "forbidden", code: "forbidden" }, 403)
    }
    if (update === "last_root") {
      return context.json({ error: "last root account", code: "last_root" }, 409)
    }

    const account = await repository.findById(targetAccountId.data)
    if (account === null || account instanceof Error) {
      return context.json(
        { error: "account service unavailable", code: "account_unavailable" },
        503,
      )
    }

    return context.json(
      {
        id: account.id,
        status: account.status,
        token_version: account.tokenVersion,
        role_keys: account.roleKeys,
        created_at: account.createdAt.toISOString(),
        updated_at: account.updatedAt.toISOString(),
      },
      200,
    )
  },
)
