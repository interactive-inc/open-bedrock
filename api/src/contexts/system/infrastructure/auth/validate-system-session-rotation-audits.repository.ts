import type { SessionRotationAuditEvents } from "@system/infrastructure/auth/session-port.repository"
import type { SessionRotation } from "@system/domain/auth/session-rotation"

/** rotation各decisionの監査が同じ操作と主体を表すことを検証する。 */
export function validateSystemSessionRotationAudits(
  rotation: SessionRotation,
  audits: SessionRotationAuditEvents,
): Error | null {
  const previous = rotation.previous
  const rotatedAt = previous.rotatedAt?.getTime()
  const eventIds = [audits.rotated.eventId, audits.reused.eventId, audits.invalid.eventId]
  const commonEvents = [audits.rotated, audits.reused, audits.invalid]
  const hasInvalidCommonField = commonEvents.some(
    (event) =>
      event.actorAccountId !== previous.accountId ||
      event.action !== "auth.session.rotate" ||
      event.targetType !== "session" ||
      event.targetId !== previous.id ||
      event.occurredAtEpochMilliseconds !== rotatedAt,
  )

  if (rotatedAt === undefined || !Number.isFinite(rotatedAt)) {
    return new Error("System Session rotation time is invalid")
  }
  if (new Set(eventIds).size !== eventIds.length) {
    return new Error("System Session rotation audit IDs must be unique")
  }
  if (hasInvalidCommonField) {
    return new Error("System Session rotation audits do not identify the same operation")
  }
  if (audits.rotated.outcome !== "succeeded" || audits.rotated.reasonCode !== null) {
    return new Error("rotated System Session audit is invalid")
  }
  if (audits.reused.outcome !== "denied" || audits.reused.reasonCode !== "refresh_token_reused") {
    return new Error("reused System Session audit is invalid")
  }
  if (audits.invalid.outcome !== "denied" || audits.invalid.reasonCode !== "session_invalid") {
    return new Error("invalid System Session audit is invalid")
  }

  return null
}
