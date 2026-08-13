import type {
  RevokeSessionFamilyProps,
  SessionRepository,
  SessionRotationAuditEvents,
} from "@system/application/auth/session-repository"
import type { SystemAuditEvent } from "@system/domain/audit/system-audit-event"
import type { RefreshTokenRotationDecision } from "@system/domain/auth/refresh-token-rotation-decision"
import type { SessionRotation } from "@system/domain/auth/session-rotation"
import type { SessionTokenHash } from "@system/domain/auth/session-token-hash"
import type { Session } from "@system/domain/auth/session.entity"
import { SystemAuditEventRepository } from "@system/infrastructure/audit/system-audit-event-repository"
import type { SystemD1Context } from "@system/infrastructure/configuration/system-context"
import { parseSystemSessionRotationResult } from "@system/infrastructure/auth/parse-system-session-rotation-result"
import { prepareSystemSessionCreateInvariant } from "@system/infrastructure/auth/prepare-system-session-create-invariant"
import { prepareSystemSessionRotationAudit } from "@system/infrastructure/auth/prepare-system-session-rotation-audit"
import { prepareSystemSessionRotationInvariant } from "@system/infrastructure/auth/prepare-system-session-rotation-invariant"
import { toSystemSession } from "@system/infrastructure/auth/to-system-session"
import { validateSystemSessionRotationAudits } from "@system/infrastructure/auth/validate-system-session-rotation-audits"

type Props = Readonly<{
  context: SystemD1Context
}>

/** canonical System tableだけでSession lifecycleと監査を原子的に永続化する。 */
export class SystemSessionRepository implements SessionRepository {
  constructor(private readonly props: Props) {
    Object.freeze(this)
  }

  async createWithAudit(session: Session, audit: SystemAuditEvent): Promise<void | Error> {
    if (session.rotatedAt !== null || session.revokedAt !== null) {
      return new Error("new System Session must be active")
    }

    try {
      const database = this.props.context.env.DB
      const auditStatements = new SystemAuditEventRepository(this.props.context).prepareAppend(
        audit,
      )
      const results = await database.batch([
        this.prepareCreate(session),
        prepareSystemSessionCreateInvariant(database, session),
        ...auditStatements,
      ])

      return results.length === 4 && results.every((result) => result.success)
        ? undefined
        : new Error("audited System Session creation did not succeed")
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to create System Session")
    }
  }

  async findByTokenHash(tokenHash: SessionTokenHash): Promise<Session | null | Error> {
    try {
      const storageRow = await this.props.context.env.DB.prepare(
        `SELECT id, account_id, family_id, token_hash, token_version,
                created_at, expires_at, rotated_at, revoked_at
         FROM system_sessions
         WHERE token_hash = ?1
         LIMIT 1`,
      )
        .bind(tokenHash)
        .first<Record<string, unknown>>()

      return storageRow === null ? null : toSystemSession(storageRow)
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to find System Session")
    }
  }

  async rotateWithAudit(
    rotation: SessionRotation,
    audits: SessionRotationAuditEvents,
  ): Promise<RefreshTokenRotationDecision | Error> {
    const validationError = validateSystemSessionRotationAudits(rotation, audits)

    if (validationError !== null) return validationError

    try {
      const database = this.props.context.env.DB
      const results = await database.batch([
        prepareSystemSessionRotationAudit({ database, rotation, audits }),
        this.prepareConsumePrevious(rotation, audits),
        this.prepareCreateSuccessor(rotation, audits),
        this.prepareRevokeRejectedFamily(rotation, audits),
        prepareSystemSessionRotationInvariant({ database, rotation, audits }),
      ])

      if (results.length !== 5 || results.some((result) => !result.success)) {
        return new Error("audited System Session rotation did not succeed")
      }

      return parseSystemSessionRotationResult(results[0], audits)
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to rotate System Session")
    }
  }

  async revokeFamilyWithAudit(props: RevokeSessionFamilyProps): Promise<void | Error> {
    if (!Number.isFinite(props.revokedAt.getTime())) {
      return new Error("System Session family revocation time is invalid")
    }

    try {
      const database = this.props.context.env.DB
      const auditStatements = new SystemAuditEventRepository(this.props.context).prepareAppend(
        props.audit,
      )
      const results = await database.batch([
        database
          .prepare(
            `UPDATE system_sessions
             SET revoked_at = ?1
             WHERE family_id = ?2
               AND revoked_at IS NULL
               AND created_at <= ?1
               AND (rotated_at IS NULL OR rotated_at <= ?1)`,
          )
          .bind(props.revokedAt.getTime(), props.familyId),
        ...auditStatements,
        database
          .prepare(
            `SELECT CASE WHEN NOT EXISTS (
               SELECT 1 FROM system_sessions WHERE family_id = ?1 AND revoked_at IS NULL
             ) THEN 1 ELSE json_extract('', '$') END AS ok`,
          )
          .bind(props.familyId),
      ])

      return results.length === 4 && results.every((result) => result.success)
        ? undefined
        : new Error("audited System Session family revocation did not succeed")
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to revoke System Session family")
    }
  }

  private prepareCreate(session: Session): D1PreparedStatement {
    return this.props.context.env.DB.prepare(
      `INSERT INTO system_sessions
         (id, account_id, family_id, token_hash, token_version,
          created_at, expires_at, rotated_at, revoked_at)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, NULL, NULL
       WHERE EXISTS (
         SELECT 1 FROM system_accounts
         WHERE id = ?2 AND status = 'active' AND token_version = ?5
       )
       RETURNING id`,
    ).bind(
      session.id,
      session.accountId,
      session.familyId,
      session.tokenHash,
      session.tokenVersion,
      session.createdAt.getTime(),
      session.expiresAt.getTime(),
    )
  }

  private prepareConsumePrevious(
    rotation: SessionRotation,
    audits: SessionRotationAuditEvents,
  ): D1PreparedStatement {
    const previous = rotation.previous

    return this.props.context.env.DB.prepare(
      `UPDATE system_sessions
       SET rotated_at = ?1
       WHERE id = ?2 AND token_hash = ?3 AND account_id = ?4 AND family_id = ?5
         AND token_version = ?6 AND created_at = ?7 AND expires_at = ?8
         AND rotated_at IS NULL AND revoked_at IS NULL
         AND EXISTS (SELECT 1 FROM system_audit_events WHERE event_id = ?9)`,
    ).bind(
      previous.rotatedAt?.getTime() ?? Number.NaN,
      previous.id,
      previous.tokenHash,
      previous.accountId,
      previous.familyId,
      previous.tokenVersion,
      previous.createdAt.getTime(),
      previous.expiresAt.getTime(),
      audits.rotated.eventId,
    )
  }

  private prepareCreateSuccessor(
    rotation: SessionRotation,
    audits: SessionRotationAuditEvents,
  ): D1PreparedStatement {
    const previous = rotation.previous
    const successor = rotation.successor

    return this.props.context.env.DB.prepare(
      `INSERT INTO system_sessions
         (id, account_id, family_id, token_hash, token_version,
          created_at, expires_at, rotated_at, revoked_at)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, NULL, NULL
       WHERE EXISTS (SELECT 1 FROM system_audit_events WHERE event_id = ?8)
         AND EXISTS (
           SELECT 1 FROM system_sessions
           WHERE id = ?9 AND token_hash = ?10 AND rotated_at = ?6 AND revoked_at IS NULL
         )`,
    ).bind(
      successor.id,
      successor.accountId,
      successor.familyId,
      successor.tokenHash,
      successor.tokenVersion,
      successor.createdAt.getTime(),
      successor.expiresAt.getTime(),
      audits.rotated.eventId,
      previous.id,
      previous.tokenHash,
    )
  }

  private prepareRevokeRejectedFamily(
    rotation: SessionRotation,
    audits: SessionRotationAuditEvents,
  ): D1PreparedStatement {
    const previous = rotation.previous

    return this.props.context.env.DB.prepare(
      `UPDATE system_sessions
       SET revoked_at = ?1
       WHERE family_id = ?2 AND revoked_at IS NULL
         AND EXISTS (
           SELECT 1 FROM system_audit_events WHERE event_id IN (?3, ?4)
         )`,
    ).bind(
      previous.rotatedAt?.getTime() ?? Number.NaN,
      previous.familyId,
      audits.reused.eventId,
      audits.invalid.eventId,
    )
  }
}
