/** /system/v1/accounts/:accountId/role-bindings */
import { zAccountId } from "@system/domain/auth/account-id"
import { createSystemAuditEvent } from "@system/domain/audit/create-system-audit-event"
import { toStableSystemAuditJson } from "@system/domain/audit/to-stable-system-audit-json"
import { iamRoleIdSchema } from "@system/domain/iam/iam-role.entity"
import { RoleBinding } from "@system/domain/iam/role-binding.entity"
import { SystemAuditEventRepository } from "@system/infrastructure/audit/system-audit-event-repository"
import { SystemAccountAdministrationRepository } from "@system/infrastructure/iam/system-account-administration-repository"
import { SystemRoleAdministrationRepository } from "@system/infrastructure/iam/system-role-administration-repository"
import { SystemRoleBindingAdministrationRepository } from "@system/infrastructure/iam/system-role-binding-administration-repository"
import { authenticateSystemAccessToken } from "@system/interface/http/authenticate-system-access-token"
import { systemFactory } from "@system/interface/http/system-factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization permission iam:read - Accountが所有するSystem Role Binding履歴を読む
export const GET = systemFactory.createHandlers(authenticateSystemAccessToken, async (context) => {
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
    return context.json({ error: "IAM service unavailable", code: "iam_unavailable" }, 503)
  }
  if (account === null) {
    return context.json({ error: "account not found", code: "account_not_found" }, 404)
  }
  const bindings = await new SystemRoleBindingAdministrationRepository({
    env: { DB: context.env.DB },
  }).listForAccount(accountId.data)
  if (bindings instanceof Error) {
    return context.json({ error: "IAM service unavailable", code: "iam_unavailable" }, 503)
  }

  return context.json(
    {
      role_bindings: bindings.map((binding) => ({
        id: binding.id,
        account_id: binding.accountId,
        role_id: binding.roleId,
        resource:
          binding.resource === null
            ? null
            : { type: binding.resource.type, id: binding.resource.id },
        created_at: binding.createdAt.toISOString(),
        revoked_at: binding.revokedAt?.toISOString() ?? null,
      })),
      total: bindings.length,
    },
    200,
  )
})

// @authorization permission iam:write - 自己付与とactor未保有permissionの付与を拒否する
export const POST = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator(
    "json",
    z
      .object({
        role_id: z.string().min(1).max(255),
        resource: z
          .object({
            type: z
              .string()
              .min(3)
              .max(100)
              .regex(/^[a-z][a-z0-9_]*(?::[a-z][a-z0-9_]*)+$/),
            id: z.string().min(1).max(255),
          })
          .strict()
          .nullable(),
      })
      .strict(),
  ),
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
    if (actorAccountId.data === targetAccountId.data) {
      return context.json({ error: "self assignment is forbidden", code: "self_assignment" }, 403)
    }
    const body = context.req.valid("json")
    const roleId = iamRoleIdSchema.safeParse(body.role_id)
    if (!roleId.success) {
      return context.json({ error: "role not found", code: "role_not_found" }, 404)
    }
    const role = await new SystemRoleAdministrationRepository({
      env: { DB: context.env.DB },
    }).findById(roleId.data)
    if (role instanceof Error) {
      return context.json({ error: "IAM service unavailable", code: "iam_unavailable" }, 503)
    }
    if (role === null) {
      return context.json({ error: "role not found", code: "role_not_found" }, 404)
    }
    const now = context.var.now()
    if (!Number.isSafeInteger(now.getTime())) {
      return context.json({ error: "IAM service unavailable", code: "iam_unavailable" }, 503)
    }
    const binding = RoleBinding.create({
      id: crypto.randomUUID(),
      accountId: targetAccountId.data,
      roleId: role.id,
      resource: body.resource,
      createdAt: now,
      revokedAt: null,
    })
    if (binding instanceof Error) {
      return context.json({ error: "invalid role binding", code: "invalid_role_binding" }, 400)
    }
    const afterJson = toStableSystemAuditJson({
      account_id: binding.accountId,
      resource:
        binding.resource === null ? null : { id: binding.resource.id, type: binding.resource.type },
      role_id: binding.roleId,
    })
    if (afterJson instanceof Error) {
      return context.json({ error: "IAM service unavailable", code: "iam_unavailable" }, 503)
    }
    const auditEvent = createSystemAuditEvent({
      actorAccountId: actorAccountId.data,
      action: "system.iam.role_binding.created",
      targetType: "system:role-binding",
      targetId: binding.id,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: null,
      beforeJson: null,
      afterJson,
      metadataJson: null,
      occurredAt: now,
    })
    if (auditEvent instanceof Error) {
      return context.json({ error: "IAM service unavailable", code: "iam_unavailable" }, 503)
    }
    const auditStatements = new SystemAuditEventRepository({
      env: { DB: context.env.DB },
    }).prepareAppend(auditEvent)
    const creation = await new SystemRoleBindingAdministrationRepository({
      env: { DB: context.env.DB },
    }).create(actorAccountId.data, role, binding, auditStatements)
    if (creation instanceof Error) {
      return context.json({ error: "IAM service unavailable", code: "iam_unavailable" }, 503)
    }
    if (creation === "forbidden") {
      return context.json({ error: "forbidden", code: "forbidden" }, 403)
    }
    if (creation === "conflict") {
      return context.json({ error: "role binding conflict", code: "role_binding_conflict" }, 409)
    }

    return context.json(
      {
        id: binding.id,
        account_id: binding.accountId,
        role_id: binding.roleId,
        resource:
          binding.resource === null
            ? null
            : { type: binding.resource.type, id: binding.resource.id },
        created_at: binding.createdAt.toISOString(),
        revoked_at: null,
      },
      201,
    )
  },
)
