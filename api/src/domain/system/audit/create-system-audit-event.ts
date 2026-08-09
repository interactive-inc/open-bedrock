import type {
  SystemAuditEvent,
  SystemAuditEventInput,
  SystemAuditIdentifier,
} from "@/domain/system/audit/system-audit-event"
import { validateSystemAuditEventInput } from "@/domain/system/audit/validate-system-audit-event-input"

/** ID表現と永続化方式に依存しないimmutableなSystem監査イベントを生成する。 */
export function createSystemAuditEvent<ActorAccountId extends SystemAuditIdentifier>(
  input: SystemAuditEventInput<ActorAccountId>,
): SystemAuditEvent<ActorAccountId> | Error {
  const validationError = validateSystemAuditEventInput(input)
  if (validationError !== null) return validationError

  return Object.freeze({
    eventId: crypto.randomUUID(),
    actorAccountId: input.actorAccountId,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    outcome: input.outcome,
    reasonCode: input.reasonCode,
    authorizationJson: input.authorizationJson,
    beforeJson: input.beforeJson,
    afterJson: input.afterJson,
    metadataJson: input.metadataJson,
    occurredAtEpochMilliseconds: Date.prototype.getTime.call(input.occurredAt),
  })
}
