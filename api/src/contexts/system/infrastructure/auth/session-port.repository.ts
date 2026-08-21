import type { SystemAuditEvent } from "@system/domain/audit/system-audit-event"
import type { RefreshTokenRotationDecision } from "@system/domain/auth/refresh-token-rotation-decision"
import type { SessionFamilyId } from "@system/domain/auth/session-family-id"
import type { SessionRotation } from "@system/domain/auth/session-rotation"
import type { SessionTokenHash } from "@system/domain/auth/session-token-hash"
import type { Session } from "@system/domain/auth/session.entity"

export type SessionRotationAuditEvents = Readonly<{
  rotated: SystemAuditEvent
  reused: SystemAuditEvent
  invalid: SystemAuditEvent
}>

export type RevokeSessionFamilyProps = Readonly<{
  familyId: SessionFamilyId
  revokedAt: Date
  audit: SystemAuditEvent
}>

/** canonical System Session lifecycleを永続化するApplication port。 */
export type SessionRepository = Readonly<{
  createWithAudit: (session: Session, audit: SystemAuditEvent) => Promise<void | Error>
  findByTokenHash: (tokenHash: SessionTokenHash) => Promise<Session | null | Error>
  rotateWithAudit: (
    rotation: SessionRotation,
    audits: SessionRotationAuditEvents,
  ) => Promise<RefreshTokenRotationDecision | Error>
  revokeFamilyWithAudit: (props: RevokeSessionFamilyProps) => Promise<void | Error>
}>
