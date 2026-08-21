import { SystemHttpError } from "@system/interface/http/errors/system-http-error"
/** /system/v1/accounts/:accountId/identities/:identityId */
import { zAccountId } from "@system/domain/auth/account-id"
import { createSystemAuditEvent } from "@system/domain/audit/create-system-audit-event"
import { toStableSystemAuditJson } from "@system/domain/audit/to-stable-system-audit-json"
import { zIdentityId } from "@system/domain/identity/identity-id"
import { SystemAuditEventRepository } from "@system/infrastructure/audit/system-audit-event.repository"
import { SystemIdentityAdministrationRepository } from "@system/infrastructure/identity/system-identity-administration.repository"
import { authenticateSystemAccessToken } from "@system/interface/http/authenticate-system-access-token"
import { systemFactory } from "@system/interface/http/system-factory"

// @authorization permission iam:read - 一つのIdentity bindingと公開profileだけを読む
export const GET = systemFactory.createHandlers(authenticateSystemAccessToken, async (context) => {
  if (!context.var.permissions.has("system:admin") && !context.var.permissions.has("iam:read")) {
    throw new SystemHttpError({
      status: 403,
      code: "forbidden",
      detail: "forbidden",
    })
  }
  const accountId = zAccountId.safeParse(context.req.param("accountId"))
  const identityId = zIdentityId.safeParse(context.req.param("identityId"))
  if (!accountId.success || !identityId.success) {
    throw new SystemHttpError({
      status: 404,
      code: "identity_not_found",
      detail: "identity not found",
    })
  }
  const identity = await new SystemIdentityAdministrationRepository({
    env: { DB: context.env.DB },
  }).findById(identityId.data)
  if (identity instanceof Error) {
    throw new SystemHttpError({
      status: 503,
      code: "identity_unavailable",
      detail: "identity service unavailable",
    })
  }
  if (identity === null || identity.binding.accountId !== accountId.data) {
    throw new SystemHttpError({
      status: 404,
      code: "identity_not_found",
      detail: "identity not found",
    })
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
      throw new SystemHttpError({
        status: 403,
        code: "forbidden",
        detail: "forbidden",
      })
    }
    const actorAccountId = zAccountId.safeParse(context.var.userId)
    const targetAccountId = zAccountId.safeParse(context.req.param("accountId"))
    const identityId = zIdentityId.safeParse(context.req.param("identityId"))
    if (!actorAccountId.success) {
      throw new SystemHttpError({
        status: 401,
        code: "invalid_session",
        detail: "invalid session",
      })
    }
    if (!targetAccountId.success || !identityId.success) {
      throw new SystemHttpError({
        status: 404,
        code: "identity_not_found",
        detail: "identity not found",
      })
    }
    const repository = new SystemIdentityAdministrationRepository({ env: { DB: context.env.DB } })
    const identity = await repository.findById(identityId.data)
    if (identity instanceof Error) {
      throw new SystemHttpError({
        status: 503,
        code: "identity_unavailable",
        detail: "identity service unavailable",
      })
    }
    if (
      identity === null ||
      identity.binding.accountId !== targetAccountId.data ||
      identity.binding.state !== "active"
    ) {
      throw new SystemHttpError({
        status: 404,
        code: "identity_not_found",
        detail: "identity not found",
      })
    }
    const now = context.var.now()
    if (!Number.isSafeInteger(now.getTime())) {
      throw new SystemHttpError({
        status: 503,
        code: "identity_unavailable",
        detail: "identity service unavailable",
      })
    }
    const beforeJson = toStableSystemAuditJson({
      account_id: identity.binding.accountId,
      email: identity.email,
      email_verified: identity.isEmailVerified,
      provider: identity.binding.provider,
      subject: identity.binding.subject,
    })
    if (beforeJson instanceof Error) {
      throw new SystemHttpError({
        status: 503,
        code: "identity_unavailable",
        detail: "identity service unavailable",
      })
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
      throw new SystemHttpError({
        status: 503,
        code: "identity_unavailable",
        detail: "identity service unavailable",
      })
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
      throw new SystemHttpError({
        status: 503,
        code: "identity_unavailable",
        detail: "identity service unavailable",
      })
    }
    if (revocation === "forbidden") {
      throw new SystemHttpError({
        status: 403,
        code: "forbidden",
        detail: "forbidden",
      })
    }
    if (revocation === "not_found") {
      throw new SystemHttpError({
        status: 404,
        code: "identity_not_found",
        detail: "identity not found",
      })
    }
    if (revocation === "last_active_identity") {
      throw new SystemHttpError({
        status: 409,
        code: "last_active_identity",
        detail: "last active identity",
      })
    }
    if (revocation === "last_root") {
      throw new SystemHttpError({
        status: 409,
        code: "last_root",
        detail: "last root identity",
      })
    }

    return context.body(null, 204)
  },
)
