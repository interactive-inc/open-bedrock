import { SystemAuditUnavailableError, SystemForbiddenError } from "@system/interface/errors"
/** /system/v1/audit-events */
import { createSystemAuditEvent } from "@system/domain/audit/create-system-audit-event"
import { toStableSystemAuditJson } from "@system/domain/audit/to-stable-system-audit-json"
import { SystemAuditEventQuery } from "@system/infrastructure/audit/system-audit-event-query"
import { SystemAuditEventRepository } from "@system/infrastructure/audit/system-audit-event-repository"
import { authenticateSystemAccessToken } from "@system/interface/http/authenticate-system-access-token"
import { systemFactory } from "@system/interface/http/system-factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization permission audit:read - append-only System監査台帳を固定上限で読む
export const GET = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator(
    "query",
    z.object({
      action: z.string().min(3).max(200).optional(),
      actor_account_id: z.string().min(1).max(255).optional(),
      outcome: z.enum(["succeeded", "denied", "failed"]).optional(),
      target_type: z.string().min(1).max(200).optional(),
      target_id: z.string().min(1).max(512).optional(),
      occurred_from: z.iso.datetime().optional(),
      occurred_to: z.iso.datetime().optional(),
      limit: z.coerce.number().int().min(1).max(100).default(50),
      offset: z.coerce.number().int().min(0).max(10_000).default(0),
    }),
  ),
  async (context) => {
    const now = context.var.now()
    if (!Number.isSafeInteger(now.getTime())) {
      throw new SystemAuditUnavailableError()
    }
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
        action: "system.audit.list",
        targetType: "system:audit-event",
        targetId: null,
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

    const query = context.req.valid("query")
    const page = await new SystemAuditEventQuery({ env: { DB: context.env.DB } }).list({
      action: query.action ?? null,
      actorAccountId: query.actor_account_id ?? null,
      outcome: query.outcome ?? null,
      targetType: query.target_type ?? null,
      targetId: query.target_id ?? null,
      occurredFrom: query.occurred_from === undefined ? null : new Date(query.occurred_from),
      occurredTo: query.occurred_to === undefined ? null : new Date(query.occurred_to),
      limit: query.limit,
      offset: query.offset,
    })
    if (page instanceof Error) {
      throw new SystemAuditUnavailableError()
    }
    const metadataJson = toStableSystemAuditJson({
      action: query.action ?? null,
      actor_account_id: query.actor_account_id ?? null,
      limit: query.limit,
      offset: query.offset,
      outcome: query.outcome ?? null,
      target_id: query.target_id ?? null,
      target_type: query.target_type ?? null,
    })
    if (metadataJson instanceof Error) {
      throw new SystemAuditUnavailableError()
    }
    const succeededAudit = createSystemAuditEvent({
      actorAccountId: context.var.userId,
      action: "system.audit.list",
      targetType: "system:audit-event",
      targetId: null,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson,
      beforeJson: null,
      afterJson: null,
      metadataJson,
      occurredAt: now,
    })
    if (
      succeededAudit instanceof Error ||
      (await auditRepository.append(succeededAudit)) instanceof Error
    ) {
      throw new SystemAuditUnavailableError()
    }

    return context.json(
      {
        events: page.events.map((event) => ({
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
        })),
        total: page.total,
        limit: query.limit,
        offset: query.offset,
      },
      200,
    )
  },
)
