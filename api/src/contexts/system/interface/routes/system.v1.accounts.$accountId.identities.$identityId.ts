/** /system/v1/accounts/:accountId/identities/:identityId */
import { zAccountId } from "@system/domain/auth/account-id"
import { createSystemAuditEvent } from "@system/domain/audit/create-system-audit-event"
import { toStableSystemAuditJson } from "@system/domain/audit/to-stable-system-audit-json"
import { zIdentityId } from "@system/domain/identity/identity-id"
import { SystemAuditEventRepository } from "@system/infrastructure/audit/system-audit-event-repository"
import { SystemIdentityAdministrationRepository } from "@system/infrastructure/identity/system-identity-administration-repository"
import { authenticateSystemSession } from "@system/interface/http/authenticate-system-session"
import { systemFactory } from "@system/interface/http/system-factory"

// @authorization permission iam:read - 一つのIdentity bindingと公開profileだけを読む
export const GET = systemFactory.createHandlers(authenticateSystemSession, async (context) => {
  if (!context.var.permissions.has("system:admin") && !context.var.permissions.has("iam:read")) {
    return context.json({ error: "forbidden", code: "forbidden" }, 403)
  }
  const accountId = zAccountId.safeParse(context.req.param("accountId"))
  const identityId = zIdentityId.safeParse(context.req.param("identityId"))
  if (!accountId.success || !identityId.success) {
    return context.json({ error: "identity not found", code: "identity_not_found" }, 404)
  }
  const identity = await new SystemIdentityAdministrationRepository({
    env: { DB: context.env.DB },
  }).findById(identityId.data)
  if (identity instanceof Error) {
    return context.json(
      { error: "identity service unavailable", code: "identity_unavailable" },
      503,
    )
  }
  if (identity === null || identity.binding.accountId !== accountId.data) {
    return context.json({ error: "identity not found", code: "identity_not_found" }, 404)
  }

  return context.json(
    {
      id: identity.binding.id,
      account_id: identity.binding.accountId,
      provider: identity.binding.provider,
      subject: identity.binding.subject,
      state: identity.binding.state,
      email: identity.email,
      email_verified: identity.isEmailVerified,
      last_used_at: identity.lastUsedAt?.toISOString() ?? null,
      created_at: identity.binding.createdAt.toISOString(),
      activated_at: identity.binding.activatedAt?.toISOString() ?? null,
      revoked_at: identity.binding.revokedAt?.toISOString() ?? null,
    },
    200,
  )
})

// @authorization permission iam:write - last active Identityとlast-rootを原子的に保護する
export const DELETE = systemFactory.createHandlers(authenticateSystemSession, async (context) => {
  if (!context.var.permissions.has("system:admin") && !context.var.permissions.has("iam:write")) {
    return context.json({ error: "forbidden", code: "forbidden" }, 403)
  }
  const actorAccountId = zAccountId.safeParse(context.var.userId)
  const targetAccountId = zAccountId.safeParse(context.req.param("accountId"))
  const identityId = zIdentityId.safeParse(context.req.param("identityId"))
  if (!actorAccountId.success) {
    return context.json({ error: "invalid session", code: "invalid_session" }, 401)
  }
  if (!targetAccountId.success || !identityId.success) {
    return context.json({ error: "identity not found", code: "identity_not_found" }, 404)
  }
  const repository = new SystemIdentityAdministrationRepository({ env: { DB: context.env.DB } })
  const identity = await repository.findById(identityId.data)
  if (identity instanceof Error) {
    return context.json(
      { error: "identity service unavailable", code: "identity_unavailable" },
      503,
    )
  }
  if (
    identity === null ||
    identity.binding.accountId !== targetAccountId.data ||
    identity.binding.state !== "active"
  ) {
    return context.json({ error: "identity not found", code: "identity_not_found" }, 404)
  }
  const now = context.var.now()
  if (!Number.isSafeInteger(now.getTime())) {
    return context.json(
      { error: "identity service unavailable", code: "identity_unavailable" },
      503,
    )
  }
  const beforeJson = toStableSystemAuditJson({
    account_id: identity.binding.accountId,
    email: identity.email,
    email_verified: identity.isEmailVerified,
    provider: identity.binding.provider,
    subject: identity.binding.subject,
  })
  if (beforeJson instanceof Error) {
    return context.json(
      { error: "identity service unavailable", code: "identity_unavailable" },
      503,
    )
  }
  const auditEvent = createSystemAuditEvent({
    actorAccountId: actorAccountId.data,
    action: "system.identity.revoked",
    targetType: "system:identity",
    targetId: identity.binding.id,
    outcome: "succeeded",
    reasonCode: null,
    authorizationJson: null,
    beforeJson,
    afterJson: null,
    metadataJson: null,
    occurredAt: now,
  })
  if (auditEvent instanceof Error) {
    return context.json(
      { error: "identity service unavailable", code: "identity_unavailable" },
      503,
    )
  }
  const auditStatements = new SystemAuditEventRepository({
    env: { DB: context.env.DB },
  }).prepareAppend(auditEvent)
  const revocation = await repository.revoke({
    actorAccountId: actorAccountId.data,
    identity,
    now,
    auditStatements,
  })
  if (revocation instanceof Error) {
    return context.json(
      { error: "identity service unavailable", code: "identity_unavailable" },
      503,
    )
  }
  if (revocation === "forbidden") {
    return context.json({ error: "forbidden", code: "forbidden" }, 403)
  }
  if (revocation === "not_found") {
    return context.json({ error: "identity not found", code: "identity_not_found" }, 404)
  }
  if (revocation === "last_active_identity") {
    return context.json({ error: "last active identity", code: "last_active_identity" }, 409)
  }
  if (revocation === "last_root") {
    return context.json({ error: "last root identity", code: "last_root" }, 409)
  }

  return context.body(null, 204)
})
