import { SystemHttpError } from "@system/interface/http/errors/system-http-error"
/** /system/v1/roles */
import { zAccountId } from "@system/domain/auth/account-id"
import { createSystemAuditEvent } from "@system/domain/audit/create-system-audit-event"
import { toStableSystemAuditJson } from "@system/domain/audit/to-stable-system-audit-json"
import { IamRole } from "@system/domain/iam/iam-role.entity"
import { SystemAuditEventRepository } from "@system/infrastructure/audit/system-audit-event-repository"
import { SystemRoleAdministrationRepository } from "@system/infrastructure/iam/system-role-administration-repository"
import { authenticateSystemAccessToken } from "@system/interface/http/authenticate-system-access-token"
import { systemFactory } from "@system/interface/http/system-factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization permission iam:read - namespaced permissionを持つSystem Roleだけを読む
export const GET = systemFactory.createHandlers(authenticateSystemAccessToken, async (context) => {
  if (!context.var.permissions.has("system:admin") && !context.var.permissions.has("iam:read")) {
    throw new SystemHttpError({
      status: 403,
      code: "forbidden",
      detail: "forbidden",
    })
  }
  const roles = await new SystemRoleAdministrationRepository({
    env: { DB: context.env.DB },
  }).list()
  if (roles instanceof Error) {
    throw new SystemHttpError({
      status: 503,
      code: "iam_unavailable",
      detail: "IAM service unavailable",
    })
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
      throw new SystemHttpError({
        status: 403,
        code: "forbidden",
        detail: "forbidden",
      })
    }
    const actorAccountId = zAccountId.safeParse(context.var.userId)
    const now = context.var.now()
    if (!actorAccountId.success) {
      throw new SystemHttpError({
        status: 401,
        code: "invalid_session",
        detail: "invalid session",
      })
    }
    if (!Number.isSafeInteger(now.getTime())) {
      throw new SystemHttpError({
        status: 503,
        code: "iam_unavailable",
        detail: "IAM service unavailable",
      })
    }
    const body = context.req.valid("json")
    const role = IamRole.create({
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
      throw new SystemHttpError({
        status: 400,
        code: "invalid_role",
        detail: "invalid role",
      })
    }
    const afterJson = toStableSystemAuditJson({
      description: role.description,
      key: role.key,
      kind: role.kind,
      name: role.name,
      permission_keys: role.permissionKeys,
    })
    if (afterJson instanceof Error) {
      throw new SystemHttpError({
        status: 503,
        code: "iam_unavailable",
        detail: "IAM service unavailable",
      })
    }
    const auditEvent = createSystemAuditEvent({
      actorAccountId: actorAccountId.data,
      action: "system.iam.role.created",
      targetType: "system:iam-role",
      targetId: role.id,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: null,
      beforeJson: null,
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
    const creation = await new SystemRoleAdministrationRepository({
      env: { DB: context.env.DB },
    }).create(actorAccountId.data, role, auditStatements)
    if (creation instanceof Error) {
      throw new SystemHttpError({
        status: 503,
        code: "iam_unavailable",
        detail: "IAM service unavailable",
      })
    }
    if (creation === "forbidden") {
      throw new SystemHttpError({
        status: 403,
        code: "forbidden",
        detail: "forbidden",
      })
    }
    if (creation === "conflict") {
      throw new SystemHttpError({
        status: 409,
        code: "role_conflict",
        detail: "role conflict",
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
      201,
    )
  },
)
