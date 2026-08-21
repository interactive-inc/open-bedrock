import { createSystemSessionAudit } from "@system/domain/audit/create-system-session-audit"
import type { SessionRotationAuditEvents } from "@system/infrastructure/auth/session-port.repository"
import type { SystemSessionAuditContext } from "@system/domain/auth/system-session-audit-context"
import type { SessionRotation } from "@system/domain/auth/session-rotation"

/** rotation transactionが選ぶ3 decisionの監査を同じ主体・対象・時刻で生成する。 */
export function createSystemSessionRotationAudits(
  rotation: SessionRotation,
  context: SystemSessionAuditContext,
): SessionRotationAuditEvents | Error {
  const occurredAt = rotation.previous.rotatedAt

  if (occurredAt === null) return new Error("System Session rotation time is missing")

  const rotated = createSystemSessionAudit({
    actorAccountId: rotation.previous.accountId,
    action: "auth.session.rotate",
    targetId: rotation.previous.id,
    outcome: "succeeded",
    reasonCode: null,
    occurredAt,
    context,
  })
  if (rotated instanceof Error) return rotated

  const reused = createSystemSessionAudit({
    actorAccountId: rotation.previous.accountId,
    action: "auth.session.rotate",
    targetId: rotation.previous.id,
    outcome: "denied",
    reasonCode: "refresh_token_reused",
    occurredAt,
    context,
  })
  if (reused instanceof Error) return reused

  const invalid = createSystemSessionAudit({
    actorAccountId: rotation.previous.accountId,
    action: "auth.session.rotate",
    targetId: rotation.previous.id,
    outcome: "denied",
    reasonCode: "session_invalid",
    occurredAt,
    context,
  })
  if (invalid instanceof Error) return invalid

  return Object.freeze({ rotated, reused, invalid })
}
