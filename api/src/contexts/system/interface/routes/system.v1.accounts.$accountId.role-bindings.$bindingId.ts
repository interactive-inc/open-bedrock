import { SystemHttpError } from "@system/interface/http/errors/system-http-error"
/** /system/v1/accounts/:accountId/role-bindings/:bindingId */
import { zAccountId } from "@system/domain/auth/account-id"
import { createSystemAuditEvent } from "@system/domain/audit/create-system-audit-event"
import { toStableSystemAuditJson } from "@system/domain/audit/to-stable-system-audit-json"
import { roleBindingIdSchema } from "@system/domain/iam/role-binding.entity"
import { SystemAuditEventRepository } from "@system/infrastructure/audit/system-audit-event-repository"
import { SystemRoleAdministrationRepository } from "@system/infrastructure/iam/system-role-administration-repository"
import { SystemRoleBindingAdministrationRepository } from "@system/infrastructure/iam/system-role-binding-administration-repository"
import { authenticateSystemAccessToken } from "@system/interface/http/authenticate-system-access-token"
import { systemFactory } from "@system/interface/http/system-factory"

// @authorization permission iam:write - live権限・token失効・last-rootを同じ更新境界で検査する
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
    const bindingId = roleBindingIdSchema.safeParse(context.req.param("bindingId"))
    if (!actorAccountId.success) {
      throw new SystemHttpError({
        status: 401,
        code: "invalid_session",
        detail: "invalid session",
      })
    }
    if (!targetAccountId.success || !bindingId.success) {
      throw new SystemHttpError({
        status: 404,
        code: "role_binding_not_found",
        detail: "role binding not found",
      })
    }
    const repository = new SystemRoleBindingAdministrationRepository({
      env: { DB: context.env.DB },
    })
    const binding = await repository.findById(bindingId.data)
    if (binding instanceof Error) {
      throw new SystemHttpError({
        status: 503,
        code: "iam_unavailable",
        detail: "IAM service unavailable",
      })
    }
    if (
      binding === null ||
      binding.accountId !== targetAccountId.data ||
      binding.revokedAt !== null
    ) {
      throw new SystemHttpError({
        status: 404,
        code: "role_binding_not_found",
        detail: "role binding not found",
      })
    }
    const role = await new SystemRoleAdministrationRepository({
      env: { DB: context.env.DB },
    }).findById(binding.roleId)
    if (role instanceof Error) {
      throw new SystemHttpError({
        status: 503,
        code: "iam_unavailable",
        detail: "IAM service unavailable",
      })
    }
    if (role === null) {
      throw new SystemHttpError({
        status: 404,
        code: "role_binding_not_found",
        detail: "role binding not found",
      })
    }
    const now = context.var.now()
    if (!Number.isSafeInteger(now.getTime())) {
      throw new SystemHttpError({
        status: 503,
        code: "iam_unavailable",
        detail: "IAM service unavailable",
      })
    }
    const beforeJson = toStableSystemAuditJson({
      account_id: binding.accountId,
      resource:
        binding.resource === null ? null : { id: binding.resource.id, type: binding.resource.type },
      role_id: binding.roleId,
    })
    if (beforeJson instanceof Error) {
      throw new SystemHttpError({
        status: 503,
        code: "iam_unavailable",
        detail: "IAM service unavailable",
      })
    }
    const auditEvent = createSystemAuditEvent({
      actorAccountId: actorAccountId.data,
      action: "system.iam.role_binding.revoked",
      targetType: "system:role-binding",
      targetId: binding.id,
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
        code: "iam_unavailable",
        detail: "IAM service unavailable",
      })
    }
    const auditStatements = new SystemAuditEventRepository({
      env: { DB: context.env.DB },
    }).prepareAppend(auditEvent)
    const revocation = await repository.revoke(
      actorAccountId.data,
      role,
      binding,
      now,
      auditStatements,
    )
    if (revocation instanceof Error) {
      throw new SystemHttpError({
        status: 503,
        code: "iam_unavailable",
        detail: "IAM service unavailable",
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
        code: "role_binding_not_found",
        detail: "role binding not found",
      })
    }
    if (revocation === "last_root") {
      throw new SystemHttpError({
        status: 409,
        code: "last_root",
        detail: "last root binding",
      })
    }

    return context.body(null, 204)
  },
)
