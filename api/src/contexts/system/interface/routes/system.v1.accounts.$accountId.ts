import { SystemHttpError } from "@system/interface/http/errors/system-http-error"
/** /system/v1/accounts/:accountId */
import { zAccountId } from "@system/domain/auth/account-id"
import { createSystemAuditEvent } from "@system/domain/audit/create-system-audit-event"
import { toStableSystemAuditJson } from "@system/domain/audit/to-stable-system-audit-json"
import { SystemAuditEventRepository } from "@system/infrastructure/audit/system-audit-event-repository"
import { SystemAccountAdministrationRepository } from "@system/infrastructure/iam/system-account-administration-repository"
import { authenticateSystemAccessToken } from "@system/interface/http/authenticate-system-access-token"
import { systemFactory } from "@system/interface/http/system-factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization permission iam:read - 一つのSystem AccountをCompany情報なしで読む
export const GET = systemFactory.createHandlers(authenticateSystemAccessToken, async (context) => {
  if (!context.var.permissions.has("system:admin") && !context.var.permissions.has("iam:read")) {
    throw new SystemHttpError({
      status: 403,
      code: "forbidden",
      detail: "forbidden",
    })
  }
  const accountId = zAccountId.safeParse(context.req.param("accountId"))
  if (!accountId.success) {
    throw new SystemHttpError({
      status: 404,
      code: "account_not_found",
      detail: "account not found",
    })
  }
  const account = await new SystemAccountAdministrationRepository({
    env: { DB: context.env.DB },
  }).findById(accountId.data)
  if (account instanceof Error) {
    throw new SystemHttpError({
      status: 503,
      code: "account_unavailable",
      detail: "account service unavailable",
    })
  }
  if (account === null) {
    throw new SystemHttpError({
      status: 404,
      code: "account_not_found",
      detail: "account not found",
    })
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
  authenticateSystemAccessToken,
  zValidator("json", z.object({ status: z.enum(["active", "suspended", "locked"]) }).strict()),
  async (context) => {
    if (!context.var.permissions.has("system:admin") && !context.var.permissions.has("iam:write")) {
      throw new SystemHttpError({
        status: 403,
        code: "forbidden",
        detail: "forbidden",
      })
    }
    const actorAccountId = zAccountId.safeParse(context.var.userId)
    const targetAccountId = zAccountId.safeParse(context.req.param("accountId"))
    if (!actorAccountId.success) {
      throw new SystemHttpError({
        status: 401,
        code: "invalid_session",
        detail: "invalid session",
      })
    }
    if (!targetAccountId.success) {
      throw new SystemHttpError({
        status: 404,
        code: "account_not_found",
        detail: "account not found",
      })
    }

    const repository = new SystemAccountAdministrationRepository({ env: { DB: context.env.DB } })
    const before = await repository.findById(targetAccountId.data)
    if (before instanceof Error) {
      throw new SystemHttpError({
        status: 503,
        code: "account_unavailable",
        detail: "account service unavailable",
      })
    }
    if (before === null) {
      throw new SystemHttpError({
        status: 404,
        code: "account_not_found",
        detail: "account not found",
      })
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
      throw new SystemHttpError({
        status: 503,
        code: "account_unavailable",
        detail: "account service unavailable",
      })
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
      throw new SystemHttpError({
        status: 503,
        code: "account_unavailable",
        detail: "account service unavailable",
      })
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
      throw new SystemHttpError({
        status: 503,
        code: "account_unavailable",
        detail: "account service unavailable",
      })
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
      throw new SystemHttpError({
        status: 503,
        code: "account_unavailable",
        detail: "account service unavailable",
      })
    }
    if (update === "not_found") {
      throw new SystemHttpError({
        status: 404,
        code: "account_not_found",
        detail: "account not found",
      })
    }
    if (update === "forbidden") {
      throw new SystemHttpError({
        status: 403,
        code: "forbidden",
        detail: "forbidden",
      })
    }
    if (update === "last_root") {
      throw new SystemHttpError({
        status: 409,
        code: "last_root",
        detail: "last root account",
      })
    }

    const account = await repository.findById(targetAccountId.data)
    if (account === null || account instanceof Error) {
      throw new SystemHttpError({
        status: 503,
        code: "account_unavailable",
        detail: "account service unavailable",
      })
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
