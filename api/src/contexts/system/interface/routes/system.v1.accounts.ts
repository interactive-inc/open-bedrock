import { SystemHttpError } from "@system/interface/http/system-http-error"
/** /system/v1/accounts */
import { zAccountId } from "@system/domain/auth/account-id"
import { createSystemAuditEvent } from "@system/domain/audit/create-system-audit-event"
import { toStableSystemAuditJson } from "@system/domain/audit/to-stable-system-audit-json"
import { SystemAuditEventRepository } from "@system/infrastructure/audit/system-audit-event-repository"
import { SystemAccountAdministrationRepository } from "@system/infrastructure/iam/system-account-administration-repository"
import { authenticateSystemAccessToken } from "@system/interface/http/authenticate-system-access-token"
import { systemFactory } from "@system/interface/http/system-factory"

// @authorization permission iam:read - Company profileを含まないSystem Accountだけを読む
export const GET = systemFactory.createHandlers(authenticateSystemAccessToken, async (context) => {
  if (!context.var.permissions.has("system:admin") && !context.var.permissions.has("iam:read")) {
    throw new SystemHttpError({
      status: 403,
      code: "forbidden",
      detail: "forbidden",
    })
  }

  const accounts = await new SystemAccountAdministrationRepository({
    env: { DB: context.env.DB },
  }).list()
  if (accounts instanceof Error) {
    throw new SystemHttpError({
      status: 503,
      code: "account_unavailable",
      detail: "account service unavailable",
    })
  }

  return context.json(
    {
      accounts: accounts.map((account) => ({
        id: account.id,
        status: account.status,
        token_version: account.tokenVersion,
        role_keys: account.roleKeys,
        created_at: account.createdAt.toISOString(),
        updated_at: account.updatedAt.toISOString(),
      })),
      total: accounts.length,
    },
    200,
  )
})

// @authorization permission iam:write - Company主体を作らずopaque System Accountだけを作る
export const POST = systemFactory.createHandlers(authenticateSystemAccessToken, async (context) => {
  if (!context.var.permissions.has("system:admin") && !context.var.permissions.has("iam:write")) {
    throw new SystemHttpError({
      status: 403,
      code: "forbidden",
      detail: "forbidden",
    })
  }

  const now = context.var.now()
  const accountId = zAccountId.safeParse(crypto.randomUUID())
  if (!Number.isSafeInteger(now.getTime()) || !accountId.success) {
    throw new SystemHttpError({
      status: 503,
      code: "account_unavailable",
      detail: "account service unavailable",
    })
  }
  const afterJson = toStableSystemAuditJson({ status: "active", token_version: 0 })
  if (afterJson instanceof Error) {
    throw new SystemHttpError({
      status: 503,
      code: "account_unavailable",
      detail: "account service unavailable",
    })
  }
  const auditEvent = createSystemAuditEvent({
    actorAccountId: context.var.userId,
    action: "system.account.created",
    targetType: "system:account",
    targetId: accountId.data,
    outcome: "succeeded",
    reasonCode: null,
    authorizationJson: null,
    beforeJson: null,
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
  const repository = new SystemAccountAdministrationRepository({ env: { DB: context.env.DB } })
  const creation = await repository.create(accountId.data, now, auditStatements)
  if (creation instanceof Error) {
    throw new SystemHttpError({
      status: 503,
      code: "account_unavailable",
      detail: "account service unavailable",
    })
  }
  if (creation === "conflict") {
    throw new SystemHttpError({
      status: 409,
      code: "account_conflict",
      detail: "account conflict",
    })
  }

  const account = await repository.findById(accountId.data)
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
    201,
  )
})
