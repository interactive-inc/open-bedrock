import {
  SystemForbiddenError,
  SystemIAMUnavailableError,
  SystemInvalidSessionError,
  SystemRoleConflictError,
  SystemRoleInvalidError,
} from "@system/interface/errors"
/** /system/v1/roles */
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { StableSystemAuditJsonValue } from "@system/domain/values/audit/stable-system-audit-json.value"
import { IamRoleEntity } from "@system/domain/entities/iam-role.entity"
import { SystemAuditEventRepository } from "@system/infrastructure/audit/system-audit-event.repository"
import { SystemRoleAdministrationRepository } from "@system/infrastructure/iam/system-role-administration.repository"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { systemFactory } from "@system/interface/http/system-factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization permission iam:read - namespaced permissionを持つSystem Roleだけを読む
export const GET = systemFactory.createHandlers(authenticateSystemAccessToken, async (context) => {
  if (!context.var.permissions.has("system:admin") && !context.var.permissions.has("iam:read")) {
    throw new SystemForbiddenError()
  }
  const roles = await new SystemRoleAdministrationRepository({
    env: { DB: context.env.DB },
  }).list()
  if (roles instanceof Error) {
    throw new SystemIAMUnavailableError()
  }

  return context.json(
    {
      roles: roles.map((role) => ({
        id: role.id,
        key: role.key,
        kind: role.kind,
        name: role.name,
        description: role.description,
        permission_keys: role.permissionKeys,
        created_at: role.createdAt.toISOString(),
        updated_at: role.updatedAt.toISOString(),
      })),
      total: roles.length,
    },
    200,
  )
})

// @authorization permission iam:write - actorが保持しないpermissionをRoleへ追加できない
export const POST = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator(
    "json",
    z
      .object({
        key: z
          .string()
          .min(3)
          .max(100)
          .regex(/^[a-z][a-z0-9_-]*(?::[a-z][a-z0-9_-]*)+$/),
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
      throw new SystemForbiddenError()
    }
    const actorAccountId = zAccountId.safeParse(context.var.userId)
    const now = context.var.now()
    if (!actorAccountId.success) {
      throw new SystemInvalidSessionError()
    }
    if (!Number.isSafeInteger(now.getTime())) {
      throw new SystemIAMUnavailableError()
    }
    const body = context.req.valid("json")
    const role = IamRoleEntity.create({
      id: crypto.randomUUID(),
      key: body.key,
      kind: "custom",
      name: body.name,
      description: body.description,
      permissionKeys: [...body.permission_keys].sort(),
      createdAt: now,
      updatedAt: now,
    })
    if (role instanceof Error) {
      throw new SystemRoleInvalidError()
    }
    const afterJson = StableSystemAuditJsonValue.create({
      description: role.description,
      key: role.key,
      kind: role.kind,
      name: role.name,
      permission_keys: role.permissionKeys,
    })
    if (afterJson instanceof Error) {
      throw new SystemIAMUnavailableError()
    }
    const auditEvent = SystemAuditEventEntity.create({
      actorAccountId: actorAccountId.data,
      action: "system.iam.role.created",
      targetType: "system:iam-role",
      targetId: role.id,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: null,
      beforeJson: null,
      afterJson: afterJson?.toString() ?? null,
      metadataJson: null,
      occurredAt: now,
    })
    if (auditEvent instanceof Error) {
      throw new SystemIAMUnavailableError()
    }
    const auditStatements = new SystemAuditEventRepository({
      env: { DB: context.env.DB },
    }).prepareAppend(auditEvent)
    const creation = await new SystemRoleAdministrationRepository({
      env: { DB: context.env.DB },
    }).create(actorAccountId.data, role, auditStatements)
    if (creation instanceof Error) {
      throw new SystemIAMUnavailableError()
    }
    if (creation === "forbidden") {
      throw new SystemForbiddenError()
    }
    if (creation === "conflict") {
      throw new SystemRoleConflictError()
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
      201,
    )
  },
)
