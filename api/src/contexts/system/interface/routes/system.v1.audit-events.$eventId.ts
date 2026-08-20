import {
  SystemAuditEventNotFoundError,
  SystemAuditUnavailableError,
  SystemForbiddenError,
} from "@system/interface/errors"
/** /system/v1/audit-events/:eventId */
import { createSystemAuditEvent } from "@system/domain/audit/create-system-audit-event"
import { toStableSystemAuditJson } from "@system/domain/audit/to-stable-system-audit-json"
import { SystemAuditEventQuery } from "@system/infrastructure/audit/system-audit-event-query"
import { SystemAuditEventRepository } from "@system/infrastructure/audit/system-audit-event-repository"
import { authenticateSystemAccessToken } from "@system/interface/http/authenticate-system-access-token"
import { systemFactory } from "@system/interface/http/system-factory"
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
    const authorizationJson = toStableSystemAuditJson({
      required_permission_keys: ["audit:read"],
    })
    if (authorizationJson instanceof Error) {
      throw new SystemAuditUnavailableError()
    }
    if (
      !context.var.permissions.has("system:admin") &&
      !context.var.permissions.has("audit:read")
    ) {
      const deniedAudit = createSystemAuditEvent({
        actorAccountId: context.var.userId,
        action: "system.audit.detail",
        targetType: "system:audit-event",
        targetId: eventId,
        outcome: "denied",
        reasonCode: "forbidden",
        authorizationJson,
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

    const event = await new SystemAuditEventQuery({ env: { DB: context.env.DB } }).findById(eventId)
    if (event instanceof Error) {
      throw new SystemAuditUnavailableError()
    }
    const outcome = event === null ? "denied" : "succeeded"
    const readAudit = createSystemAuditEvent({
      actorAccountId: context.var.userId,
      action: "system.audit.detail",
      targetType: "system:audit-event",
      targetId: eventId,
      outcome,
      reasonCode: event === null ? "not_found" : null,
      authorizationJson,
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
