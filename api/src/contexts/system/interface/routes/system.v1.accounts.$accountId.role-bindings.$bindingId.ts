/** /system/v1/accounts/:accountId/role-bindings/:bindingId */
import { zAccountId } from "@system/domain/auth/account-id"
import { createSystemAuditEvent } from "@system/domain/audit/create-system-audit-event"
import { toStableSystemAuditJson } from "@system/domain/audit/to-stable-system-audit-json"
import { roleBindingIdSchema } from "@system/domain/iam/role-binding.entity"
import { SystemAuditEventRepository } from "@system/infrastructure/audit/system-audit-event-repository"
import { SystemRoleAdministrationRepository } from "@system/infrastructure/iam/system-role-administration-repository"
import { SystemRoleBindingAdministrationRepository } from "@system/infrastructure/iam/system-role-binding-administration-repository"
import { authenticateSystemSession } from "@system/interface/http/authenticate-system-session"
import { systemFactory } from "@system/interface/http/system-factory"

// @authorization permission iam:write - live権限・token失効・last-rootを同じ更新境界で検査する
export const DELETE = systemFactory.createHandlers(authenticateSystemSession, async (context) => {
  if (!context.var.permissions.has("system:admin") && !context.var.permissions.has("iam:write")) {
    return context.json({ error: "forbidden", code: "forbidden" }, 403)
  }
  const actorAccountId = zAccountId.safeParse(context.var.userId)
  const targetAccountId = zAccountId.safeParse(context.req.param("accountId"))
  const bindingId = roleBindingIdSchema.safeParse(context.req.param("bindingId"))
  if (!actorAccountId.success) {
    return context.json({ error: "invalid session", code: "invalid_session" }, 401)
  }
  if (!targetAccountId.success || !bindingId.success) {
    return context.json({ error: "role binding not found", code: "role_binding_not_found" }, 404)
  }
  const repository = new SystemRoleBindingAdministrationRepository({
    env: { DB: context.env.DB },
  })
  const binding = await repository.findById(bindingId.data)
  if (binding instanceof Error) {
    return context.json({ error: "IAM service unavailable", code: "iam_unavailable" }, 503)
  }
  if (
    binding === null ||
    binding.accountId !== targetAccountId.data ||
    binding.revokedAt !== null
  ) {
    return context.json({ error: "role binding not found", code: "role_binding_not_found" }, 404)
  }
  const role = await new SystemRoleAdministrationRepository({
    env: { DB: context.env.DB },
  }).findById(binding.roleId)
  if (role instanceof Error) {
    return context.json({ error: "IAM service unavailable", code: "iam_unavailable" }, 503)
  }
  if (role === null) {
    return context.json({ error: "role binding not found", code: "role_binding_not_found" }, 404)
  }
  const now = context.var.now()
  if (!Number.isSafeInteger(now.getTime())) {
    return context.json({ error: "IAM service unavailable", code: "iam_unavailable" }, 503)
  }
  const beforeJson = toStableSystemAuditJson({
    account_id: binding.accountId,
    resource:
      binding.resource === null ? null : { id: binding.resource.id, type: binding.resource.type },
    role_id: binding.roleId,
  })
  if (beforeJson instanceof Error) {
    return context.json({ error: "IAM service unavailable", code: "iam_unavailable" }, 503)
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
    return context.json({ error: "IAM service unavailable", code: "iam_unavailable" }, 503)
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
    return context.json({ error: "IAM service unavailable", code: "iam_unavailable" }, 503)
  }
  if (revocation === "forbidden") {
    return context.json({ error: "forbidden", code: "forbidden" }, 403)
  }
  if (revocation === "not_found") {
    return context.json({ error: "role binding not found", code: "role_binding_not_found" }, 404)
  }
  if (revocation === "last_root") {
    return context.json({ error: "last root binding", code: "last_root" }, 409)
  }

  return context.body(null, 204)
})
