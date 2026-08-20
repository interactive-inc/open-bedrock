import { SystemHttpError } from "@system/interface/http/errors/system-http-error"
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
    throw new SystemHttpError({
      status: 403,
      code: "forbidden",
      detail: "forbidden",
    })
  }
  const accountId = zAccountId.safeParse(context.req.param("accountId"))
  if (!accountId.success) {
    throw new SystemHttpError({
      status: 404,
      code: "account_not_found",
      detail: "account not found",
    })
  }
  const account = await new SystemAccountAdministrationRepository({
    env: { DB: context.env.DB },
  }).findById(accountId.data)
  if (account instanceof Error) {
    throw new SystemHttpError({
      status: 503,
      code: "iam_unavailable",
      detail: "IAM service unavailable",
    })
  }
  if (account === null) {
    throw new SystemHttpError({
      status: 404,
      code: "account_not_found",
      detail: "account not found",
    })
  }
  const bindings = await new SystemRoleBindingAdministrationRepository({
    env: { DB: context.env.DB },
  }).listForAccount(accountId.data)
  if (bindings instanceof Error) {
    throw new SystemHttpError({
      status: 503,
      code: "iam_unavailable",
      detail: "IAM service unavailable",
    })
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
      throw new SystemHttpError({
        status: 403,
        code: "forbidden",
        detail: "forbidden",
      })
    }
    const actorAccountId = zAccountId.safeParse(context.var.userId)
    const targetAccountId = zAccountId.safeParse(context.req.param("accountId"))
    if (!actorAccountId.success) {
      throw new SystemHttpError({
        status: 401,
        code: "invalid_session",
        detail: "invalid session",
      })
    }
    if (!targetAccountId.success) {
      throw new SystemHttpError({
        status: 404,
        code: "account_not_found",
        detail: "account not found",
      })
    }
    if (actorAccountId.data === targetAccountId.data) {
      throw new SystemHttpError({
        status: 403,
        code: "self_assignment",
        detail: "self assignment is forbidden",
      })
    }
    const body = context.req.valid("json")
    const roleId = iamRoleIdSchema.safeParse(body.role_id)
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
    const now = context.var.now()
    if (!Number.isSafeInteger(now.getTime())) {
      throw new SystemHttpError({
        status: 503,
        code: "iam_unavailable",
        detail: "IAM service unavailable",
      })
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
      throw new SystemHttpError({
        status: 400,
        code: "invalid_role_binding",
        detail: "invalid role binding",
      })
    }
    const afterJson = toStableSystemAuditJson({
      account_id: binding.accountId,
      resource:
        binding.resource === null ? null : { id: binding.resource.id, type: binding.resource.type },
      role_id: binding.roleId,
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
      throw new SystemHttpError({
        status: 503,
        code: "iam_unavailable",
        detail: "IAM service unavailable",
      })
    }
    const auditStatements = new SystemAuditEventRepository({
      env: { DB: context.env.DB },
    }).prepareAppend(auditEvent)
    const creation = await new SystemRoleBindingAdministrationRepository({
      env: { DB: context.env.DB },
    }).create(actorAccountId.data, role, binding, auditStatements)
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
        code: "role_binding_conflict",
        detail: "role binding conflict",
      })
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
