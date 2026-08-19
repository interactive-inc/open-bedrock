/** /system/v1/roles/:roleId */
import { zAccountId } from "@system/domain/auth/account-id"
import { createSystemAuditEvent } from "@system/domain/audit/create-system-audit-event"
import { toStableSystemAuditJson } from "@system/domain/audit/to-stable-system-audit-json"
import { iamRoleIdSchema } from "@system/domain/iam/iam-role.entity"
import { SystemAuditEventRepository } from "@system/infrastructure/audit/system-audit-event-repository"
import { SystemRoleAdministrationRepository } from "@system/infrastructure/iam/system-role-administration-repository"
import { authenticateSystemAccessToken } from "@system/interface/http/authenticate-system-access-token"
import { systemFactory } from "@system/interface/http/system-factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization permission iam:read - 一つのSystem Roleをpermission集合付きで読む
export const GET = systemFactory.createHandlers(authenticateSystemAccessToken, async (context) => {
  if (!context.var.permissions.has("system:admin") && !context.var.permissions.has("iam:read")) {
    return context.json({ error: "forbidden", code: "forbidden" }, 403)
  }
  const roleId = iamRoleIdSchema.safeParse(context.req.param("roleId"))
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

  return context.json(
    {
      id: role.id,
      key: role.key,
      kind: role.kind,
      name: role.name,
      description: role.description,
      permission_keys: role.permissionKeys,
      created_at: role.createdAt.toISOString(),
      updated_at: role.updatedAt.toISOString(),
    },
    200,
  )
})

// @authorization permission iam:write - managed Role不変・permission昇格・last-rootを検査する
export const PATCH = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator(
    "json",
    z
      .object({
        name: z.string().min(1).max(100),
        description: z.string().min(1).max(1000).nullable(),
        permission_keys: z
          .array(
            z
              .string()
              .min(3)
              .max(100)
              .regex(/^[a-z][a-z0-9_]*(?::[a-z][a-z0-9_]*)+$/),
          )
          .max(100),
      })
      .strict(),
  ),
  async (context) => {
    if (!context.var.permissions.has("system:admin") && !context.var.permissions.has("iam:write")) {
      return context.json({ error: "forbidden", code: "forbidden" }, 403)
    }
    const actorAccountId = zAccountId.safeParse(context.var.userId)
    const roleId = iamRoleIdSchema.safeParse(context.req.param("roleId"))
    if (!actorAccountId.success) {
      return context.json({ error: "invalid session", code: "invalid_session" }, 401)
    }
    if (!roleId.success) {
      return context.json({ error: "role not found", code: "role_not_found" }, 404)
    }
    const repository = new SystemRoleAdministrationRepository({ env: { DB: context.env.DB } })
    const current = await repository.findById(roleId.data)
    if (current instanceof Error) {
      return context.json({ error: "IAM service unavailable", code: "iam_unavailable" }, 503)
    }
    if (current === null) {
      return context.json({ error: "role not found", code: "role_not_found" }, 404)
    }
    if (current.kind === "managed") {
      return context.json({ error: "managed role is immutable", code: "managed_role" }, 409)
    }
    const now = context.var.now()
    if (!Number.isSafeInteger(now.getTime())) {
      return context.json({ error: "IAM service unavailable", code: "iam_unavailable" }, 503)
    }
    const body = context.req.valid("json")
    const revised = current.revise({
      name: body.name,
      description: body.description,
      permissionKeys: [...body.permission_keys].sort(),
      at: now,
    })
    if (revised instanceof Error) {
      return context.json({ error: "invalid role", code: "invalid_role" }, 400)
    }
    if (revised === current) {
      return context.json(
        {
          id: current.id,
          key: current.key,
          kind: current.kind,
          name: current.name,
          description: current.description,
          permission_keys: current.permissionKeys,
          created_at: current.createdAt.toISOString(),
          updated_at: current.updatedAt.toISOString(),
        },
        200,
      )
    }
    const beforeJson = toStableSystemAuditJson({
      description: current.description,
      name: current.name,
      permission_keys: current.permissionKeys,
    })
    const afterJson = toStableSystemAuditJson({
      description: revised.description,
      name: revised.name,
      permission_keys: revised.permissionKeys,
    })
    if (beforeJson instanceof Error || afterJson instanceof Error) {
      return context.json({ error: "IAM service unavailable", code: "iam_unavailable" }, 503)
    }
    const auditEvent = createSystemAuditEvent({
      actorAccountId: actorAccountId.data,
      action: "system.iam.role.updated",
      targetType: "system:iam-role",
      targetId: current.id,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: null,
      beforeJson,
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
    const update = await repository.update(actorAccountId.data, current, revised, auditStatements)
    if (update instanceof Error) {
      return context.json({ error: "IAM service unavailable", code: "iam_unavailable" }, 503)
    }
    if (update === "forbidden") {
      return context.json({ error: "forbidden", code: "forbidden" }, 403)
    }
    if (update === "managed_role") {
      return context.json({ error: "managed role is immutable", code: "managed_role" }, 409)
    }
    if (update === "conflict") {
      return context.json({ error: "role conflict", code: "role_conflict" }, 409)
    }

    return context.json(
      {
        id: revised.id,
        key: revised.key,
        kind: revised.kind,
        name: revised.name,
        description: revised.description,
        permission_keys: revised.permissionKeys,
        created_at: revised.createdAt.toISOString(),
        updated_at: revised.updatedAt.toISOString(),
      },
      200,
    )
  },
)

// @authorization permission iam:write - active bindingを持つRoleとmanaged Roleは削除しない
export const DELETE = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  async (context) => {
    if (!context.var.permissions.has("system:admin") && !context.var.permissions.has("iam:write")) {
      return context.json({ error: "forbidden", code: "forbidden" }, 403)
    }
    const actorAccountId = zAccountId.safeParse(context.var.userId)
    const roleId = iamRoleIdSchema.safeParse(context.req.param("roleId"))
    if (!actorAccountId.success) {
      return context.json({ error: "invalid session", code: "invalid_session" }, 401)
    }
    if (!roleId.success) {
      return context.json({ error: "role not found", code: "role_not_found" }, 404)
    }
    const repository = new SystemRoleAdministrationRepository({ env: { DB: context.env.DB } })
    const role = await repository.findById(roleId.data)
    if (role instanceof Error) {
      return context.json({ error: "IAM service unavailable", code: "iam_unavailable" }, 503)
    }
    if (role === null) {
      return context.json({ error: "role not found", code: "role_not_found" }, 404)
    }
    if (role.kind === "managed") {
      return context.json({ error: "managed role is immutable", code: "managed_role" }, 409)
    }
    const now = context.var.now()
    if (!Number.isSafeInteger(now.getTime())) {
      return context.json({ error: "IAM service unavailable", code: "iam_unavailable" }, 503)
    }
    const beforeJson = toStableSystemAuditJson({
      description: role.description,
      key: role.key,
      kind: role.kind,
      name: role.name,
      permission_keys: role.permissionKeys,
    })
    if (beforeJson instanceof Error) {
      return context.json({ error: "IAM service unavailable", code: "iam_unavailable" }, 503)
    }
    const auditEvent = createSystemAuditEvent({
      actorAccountId: actorAccountId.data,
      action: "system.iam.role.deleted",
      targetType: "system:iam-role",
      targetId: role.id,
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
    const deletion = await repository.delete(actorAccountId.data, role, auditStatements)
    if (deletion instanceof Error) {
      return context.json({ error: "IAM service unavailable", code: "iam_unavailable" }, 503)
    }
    if (deletion === "forbidden") {
      return context.json({ error: "forbidden", code: "forbidden" }, 403)
    }
    if (deletion === "managed_role") {
      return context.json({ error: "managed role is immutable", code: "managed_role" }, 409)
    }
    if (deletion === "role_in_use") {
      return context.json({ error: "role is in use", code: "role_in_use" }, 409)
    }

    return context.body(null, 204)
  },
)
