import {
  SystemAuditEventNotFoundError,
  SystemAuditUnavailableError,
  SystemForbiddenError,
} from "@system/interface/errors"
/** /system/audit-events/:eventId */
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { StableSystemAuditJsonValue } from "@system/domain/values/audit/stable-system-audit-json.value"
import { SystemAuditEventQueryAdapter } from "@system/infrastructure/adapters/audit/system-audit-event-query.adapter"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { SystemFeaturePermission } from "@system/domain/catalogs/iam/system-feature-permission.catalog"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization permission audit:read - 一つのSystem監査イベントを完全な固定列で読む
export const GET = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator("param", z.object({ eventId: z.string().uuid() })),
  async (context) => {
    const now = context.var.now()
    if (!Number.isSafeInteger(now.getTime())) {
      throw new SystemAuditUnavailableError()
    }
    const eventId = context.req.valid("param").eventId
    const auditRepository = new SystemAuditEventRepository({ env: { DB: context.env.DB } })
    const authorizationJson = StableSystemAuditJsonValue.create({
      required_permission_keys: [SystemFeaturePermission.AUDIT_READ.key],
    })
    if (authorizationJson instanceof Error) {
      throw new SystemAuditUnavailableError()
    }
    if (
      !context.var.permissions.has("system:admin") &&
      !context.var.permissions.has(SystemFeaturePermission.AUDIT_READ.key)
    ) {
      const deniedAudit = SystemAuditEventEntity.create({
        actorAccountId: context.var.userId,
        action: "system.audit.detail",
        targetType: "system:audit-event",
        targetId: eventId,
        outcome: "denied",
        reasonCode: "forbidden",
        authorizationJson: authorizationJson?.toString() ?? null,
        beforeJson: null,
        afterJson: null,
        metadataJson: null,
        occurredAt: now,
      })
      if (
        deniedAudit instanceof Error ||
        (await auditRepository.append(deniedAudit)) instanceof Error
      ) {
        throw new SystemAuditUnavailableError()
      }
      throw new SystemForbiddenError()
    }

    const event = await new SystemAuditEventQueryAdapter({
      env: { DB: context.env.DB },
    }).findById(eventId)
    if (event instanceof Error) {
      throw new SystemAuditUnavailableError()
    }
    const outcome = event === null ? "denied" : "succeeded"
    const readAudit = SystemAuditEventEntity.create({
      actorAccountId: context.var.userId,
      action: "system.audit.detail",
      targetType: "system:audit-event",
      targetId: eventId,
      outcome,
      reasonCode: event === null ? "not_found" : null,
      authorizationJson: authorizationJson?.toString() ?? null,
      beforeJson: null,
      afterJson: null,
      metadataJson: null,
      occurredAt: now,
    })
    if (readAudit instanceof Error || (await auditRepository.append(readAudit)) instanceof Error) {
      throw new SystemAuditUnavailableError()
    }
    if (event === null) {
      throw new SystemAuditEventNotFoundError()
    }

    return context.json(
      {
        event_id: event.eventId,
        actor_account_id: event.actorAccountId,
        action: event.action,
        target_type: event.targetType,
        target_id: event.targetId,
        outcome: event.outcome,
        reason_code: event.reasonCode,
        authorization_json: event.authorizationJson,
        before_json: event.beforeJson,
        after_json: event.afterJson,
        metadata_json: event.metadataJson,
        occurred_at: new Date(event.occurredAtEpochMilliseconds).toISOString(),
      },
      200,
    )
  },
)
