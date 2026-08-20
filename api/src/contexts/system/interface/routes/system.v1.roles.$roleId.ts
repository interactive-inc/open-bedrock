import { SystemHttpError } from "@system/interface/http/system-http-error"
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
    throw new SystemHttpError({
      status: 403,
      code: "forbidden",
      detail: "forbidden",
    })
  }
  const roleId = iamRoleIdSchema.safeParse(context.req.param("roleId"))
  if (!roleId.success) {
    throw new SystemHttpError({
      status: 404,
      code: "role_not_found",
      detail: "role not found",
    })
  }
  const role = await new SystemRoleAdministrationRepository({
    env: { DB: context.env.DB },
  }).findById(roleId.data)
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
      code: "role_not_found",
      detail: "role not found",
    })
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
      throw new SystemHttpError({
        status: 403,
        code: "forbidden",
        detail: "forbidden",
      })
    }
    const actorAccountId = zAccountId.safeParse(context.var.userId)
    const roleId = iamRoleIdSchema.safeParse(context.req.param("roleId"))
    if (!actorAccountId.success) {
      throw new SystemHttpError({
        status: 401,
        code: "invalid_session",
        detail: "invalid session",
      })
    }
    if (!roleId.success) {
      throw new SystemHttpError({
        status: 404,
        code: "role_not_found",
        detail: "role not found",
      })
    }
    const repository = new SystemRoleAdministrationRepository({ env: { DB: context.env.DB } })
    const current = await repository.findById(roleId.data)
    if (current instanceof Error) {
      throw new SystemHttpError({
        status: 503,
        code: "iam_unavailable",
        detail: "IAM service unavailable",
      })
    }
    if (current === null) {
      throw new SystemHttpError({
        status: 404,
        code: "role_not_found",
        detail: "role not found",
      })
    }
    if (current.kind === "managed") {
      throw new SystemHttpError({
        status: 409,
        code: "managed_role",
        detail: "managed role is immutable",
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
    const body = context.req.valid("json")
    const revised = current.revise({
      name: body.name,
      description: body.description,
      permissionKeys: [...body.permission_keys].sort(),
      at: now,
    })
    if (revised instanceof Error) {
      throw new SystemHttpError({
        status: 400,
        code: "invalid_role",
        detail: "invalid role",
      })
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
      throw new SystemHttpError({
        status: 503,
        code: "iam_unavailable",
        detail: "IAM service unavailable",
      })
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
      throw new SystemHttpError({
        status: 503,
        code: "iam_unavailable",
        detail: "IAM service unavailable",
      })
    }
    const auditStatements = new SystemAuditEventRepository({
      env: { DB: context.env.DB },
    }).prepareAppend(auditEvent)
    const update = await repository.update(actorAccountId.data, current, revised, auditStatements)
    if (update instanceof Error) {
      throw new SystemHttpError({
        status: 503,
        code: "iam_unavailable",
        detail: "IAM service unavailable",
      })
    }
    if (update === "forbidden") {
      throw new SystemHttpError({
        status: 403,
        code: "forbidden",
        detail: "forbidden",
      })
    }
    if (update === "managed_role") {
      throw new SystemHttpError({
        status: 409,
        code: "managed_role",
        detail: "managed role is immutable",
      })
    }
    if (update === "conflict") {
      throw new SystemHttpError({
        status: 409,
        code: "role_conflict",
        detail: "role conflict",
      })
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
      throw new SystemHttpError({
        status: 403,
        code: "forbidden",
        detail: "forbidden",
      })
    }
    const actorAccountId = zAccountId.safeParse(context.var.userId)
    const roleId = iamRoleIdSchema.safeParse(context.req.param("roleId"))
    if (!actorAccountId.success) {
      throw new SystemHttpError({
        status: 401,
        code: "invalid_session",
        detail: "invalid session",
      })
    }
    if (!roleId.success) {
      throw new SystemHttpError({
        status: 404,
        code: "role_not_found",
        detail: "role not found",
      })
    }
    const repository = new SystemRoleAdministrationRepository({ env: { DB: context.env.DB } })
    const role = await repository.findById(roleId.data)
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
        code: "role_not_found",
        detail: "role not found",
      })
    }
    if (role.kind === "managed") {
      throw new SystemHttpError({
        status: 409,
        code: "managed_role",
        detail: "managed role is immutable",
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
      description: role.description,
      key: role.key,
      kind: role.kind,
      name: role.name,
      permission_keys: role.permissionKeys,
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
      throw new SystemHttpError({
        status: 503,
        code: "iam_unavailable",
        detail: "IAM service unavailable",
      })
    }
    const auditStatements = new SystemAuditEventRepository({
      env: { DB: context.env.DB },
    }).prepareAppend(auditEvent)
    const deletion = await repository.delete(actorAccountId.data, role, auditStatements)
    if (deletion instanceof Error) {
      throw new SystemHttpError({
        status: 503,
        code: "iam_unavailable",
        detail: "IAM service unavailable",
      })
    }
    if (deletion === "forbidden") {
      throw new SystemHttpError({
        status: 403,
        code: "forbidden",
        detail: "forbidden",
      })
    }
    if (deletion === "managed_role") {
      throw new SystemHttpError({
        status: 409,
        code: "managed_role",
        detail: "managed role is immutable",
      })
    }
    if (deletion === "role_in_use") {
      throw new SystemHttpError({
        status: 409,
        code: "role_in_use",
        detail: "role is in use",
      })
    }

    return context.body(null, 204)
  },
)
