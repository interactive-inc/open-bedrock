import {
  SystemForbiddenError,
  SystemIdentityNotFoundError,
  SystemIdentityUnavailableError,
  SystemInvalidSessionError,
  SystemLastActiveIdentityError,
  SystemLastRootError,
} from "@system/interface/errors"
/** /system/v1/accounts/:accountId/identities/:identityId */
import { zAccountId } from "@system/domain/auth/account-id"
import { createSystemAuditEvent } from "@system/domain/audit/create-system-audit-event"
import { toStableSystemAuditJson } from "@system/domain/audit/to-stable-system-audit-json"
import { zIdentityId } from "@system/domain/identity/identity-id"
import { SystemAuditEventRepository } from "@system/infrastructure/audit/system-audit-event-repository"
import { SystemIdentityAdministrationRepository } from "@system/infrastructure/identity/system-identity-administration-repository"
import { authenticateSystemAccessToken } from "@system/interface/http/authenticate-system-access-token"
import { systemFactory } from "@system/interface/http/system-factory"

// @authorization permission iam:read - 一つのIdentity bindingと公開profileだけを読む
export const GET = systemFactory.createHandlers(authenticateSystemAccessToken, async (context) => {
  if (!context.var.permissions.has("system:admin") && !context.var.permissions.has("iam:read")) {
    throw new SystemForbiddenError()
  }
  const accountId = zAccountId.safeParse(context.req.param("accountId"))
  const identityId = zIdentityId.safeParse(context.req.param("identityId"))
  if (!accountId.success || !identityId.success) {
    throw new SystemIdentityNotFoundError()
  }
  const identity = await new SystemIdentityAdministrationRepository({
    env: { DB: context.env.DB },
  }).findById(identityId.data)
  if (identity instanceof Error) {
    throw new SystemIdentityUnavailableError()
  }
  if (identity === null || identity.binding.accountId !== accountId.data) {
    throw new SystemIdentityNotFoundError()
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
export const DELETE = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  async (context) => {
    if (!context.var.permissions.has("system:admin") && !context.var.permissions.has("iam:write")) {
      throw new SystemForbiddenError()
    }
    const actorAccountId = zAccountId.safeParse(context.var.userId)
    const targetAccountId = zAccountId.safeParse(context.req.param("accountId"))
    const identityId = zIdentityId.safeParse(context.req.param("identityId"))
    if (!actorAccountId.success) {
      throw new SystemInvalidSessionError()
    }
    if (!targetAccountId.success || !identityId.success) {
      throw new SystemIdentityNotFoundError()
    }
    const repository = new SystemIdentityAdministrationRepository({ env: { DB: context.env.DB } })
    const identity = await repository.findById(identityId.data)
    if (identity instanceof Error) {
      throw new SystemIdentityUnavailableError()
    }
    if (
      identity === null ||
      identity.binding.accountId !== targetAccountId.data ||
      identity.binding.state !== "active"
    ) {
      throw new SystemIdentityNotFoundError()
    }
    const now = context.var.now()
    if (!Number.isSafeInteger(now.getTime())) {
      throw new SystemIdentityUnavailableError()
    }
    const beforeJson = toStableSystemAuditJson({
      account_id: identity.binding.accountId,
      email: identity.email,
      email_verified: identity.isEmailVerified,
      provider: identity.binding.provider,
      subject: identity.binding.subject,
    })
    if (beforeJson instanceof Error) {
      throw new SystemIdentityUnavailableError()
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
      throw new SystemIdentityUnavailableError()
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
      throw new SystemIdentityUnavailableError()
    }
    if (revocation === "forbidden") {
      throw new SystemForbiddenError()
    }
    if (revocation === "not_found") {
      throw new SystemIdentityNotFoundError()
    }
    if (revocation === "last_active_identity") {
      throw new SystemLastActiveIdentityError()
    }
    if (revocation === "last_root") {
      throw new SystemLastRootError({ detail: "last root identity" })
    }

    return context.body(null, 204)
  },
)
