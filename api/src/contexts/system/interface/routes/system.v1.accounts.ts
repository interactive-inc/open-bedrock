/** /system/v1/accounts */
import { zAccountId } from "@system/domain/auth/account-id"
import { createSystemAuditEvent } from "@system/domain/audit/create-system-audit-event"
import { toStableSystemAuditJson } from "@system/domain/audit/to-stable-system-audit-json"
import { SystemAuditEventRepository } from "@system/infrastructure/audit/system-audit-event-repository"
import { SystemAccountAdministrationRepository } from "@system/infrastructure/iam/system-account-administration-repository"
import { authenticateSystemSession } from "@system/interface/http/authenticate-system-session"
import { systemFactory } from "@system/interface/http/system-factory"

// @authorization permission iam:read - Company profileを含まないSystem Accountだけを読む
export const GET = systemFactory.createHandlers(authenticateSystemSession, async (context) => {
  if (!context.var.permissions.has("system:admin") && !context.var.permissions.has("iam:read")) {
    return context.json({ error: "forbidden", code: "forbidden" }, 403)
  }

  const accounts = await new SystemAccountAdministrationRepository({
    env: { DB: context.env.DB },
  }).list()
  if (accounts instanceof Error) {
    return context.json({ error: "account service unavailable", code: "account_unavailable" }, 503)
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
export const POST = systemFactory.createHandlers(authenticateSystemSession, async (context) => {
  if (!context.var.permissions.has("system:admin") && !context.var.permissions.has("iam:write")) {
    return context.json({ error: "forbidden", code: "forbidden" }, 403)
  }

  const now = context.var.now()
  const accountId = zAccountId.safeParse(crypto.randomUUID())
  if (!Number.isSafeInteger(now.getTime()) || !accountId.success) {
    return context.json({ error: "account service unavailable", code: "account_unavailable" }, 503)
  }
  const afterJson = toStableSystemAuditJson({ status: "active", token_version: 0 })
  if (afterJson instanceof Error) {
    return context.json({ error: "account service unavailable", code: "account_unavailable" }, 503)
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
    return context.json({ error: "account service unavailable", code: "account_unavailable" }, 503)
  }
  const auditStatements = new SystemAuditEventRepository({
    env: { DB: context.env.DB },
  }).prepareAppend(auditEvent)
  const repository = new SystemAccountAdministrationRepository({ env: { DB: context.env.DB } })
  const creation = await repository.create(accountId.data, now, auditStatements)
  if (creation instanceof Error) {
    return context.json({ error: "account service unavailable", code: "account_unavailable" }, 503)
  }
  if (creation === "conflict") {
    return context.json({ error: "account conflict", code: "account_conflict" }, 409)
  }

  const account = await repository.findById(accountId.data)
  if (account === null || account instanceof Error) {
    return context.json({ error: "account service unavailable", code: "account_unavailable" }, 503)
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
