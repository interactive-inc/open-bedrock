import type { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import type { RefreshTokenRotationDecision } from "@system/domain/definitions/auth/refresh-token-rotation-decision.definition"
import type { SessionFamilyId } from "@system/domain/schemas/auth/session-family-id.schema"
import type { SessionRotationValue } from "@system/domain/values/auth/session-rotation.value"
import type { SessionRotationAuditEvents } from "@system/domain/definitions/auth/session-rotation-audit-events.definition"
import type { SessionTokenHash } from "@system/domain/schemas/auth/session-token-hash.schema"
import type { SessionEntity } from "@system/domain/entities/session.entity"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { SessionId } from "@system/domain/schemas/auth/session-id.schema"
import { SystemAuditEventRepository } from "@system/infrastructure/audit/system-audit-event.repository"
import type { SystemD1Context } from "@system/infrastructure/configuration/system-context.repository"
import { parseSystemSessionRotationResult } from "@system/infrastructure/auth/parse-system-session-rotation-result.repository"
import { prepareSystemSessionCreateInvariant } from "@system/infrastructure/auth/prepare-system-session-create-invariant.repository"
import { prepareSystemSessionRotationAudit } from "@system/infrastructure/auth/prepare-system-session-rotation-audit.repository"
import { prepareSystemSessionRotationInvariant } from "@system/infrastructure/auth/prepare-system-session-rotation-invariant.repository"
import { toSystemSession } from "@system/infrastructure/auth/to-system-session.repository"
import { validateSystemSessionRotationAudits } from "@system/infrastructure/auth/validate-system-session-rotation-audits.repository"
import { SystemAccountRepository } from "@system/infrastructure/auth/system-account.repository"

type Props = Readonly<{
  context: SystemD1Context
}>

export type RevokeSessionFamilyProps = Readonly<{
  familyId: SessionFamilyId
  revokedAt: Date
  audit: SystemAuditEventEntity
}>

export type SystemSessionAuthentication =
  | Readonly<{
      kind: "authenticated"
      accountId: AccountId
      tokenVersion: number
      sessionId: SessionId
      expiresAt: Date
    }>
  | Readonly<{ kind: "rejected"; reason: "invalid" }>

/** canonical System tableだけでSessionEntity lifecycleと監査を原子的に永続化する。 */
export class SystemSessionRepository {
  constructor(private readonly props: Props) {
    Object.freeze(this)
  }

  async createWithAudit(
    session: SessionEntity,
    audit: SystemAuditEventEntity,
  ): Promise<void | Error> {
    if (session.rotatedAt !== null || session.revokedAt !== null) {
      return new Error("new System SessionEntity must be active")
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
        : new Error("audited System SessionEntity creation did not succeed")
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to create System SessionEntity")
    }
  }

  async findByTokenHash(tokenHash: SessionTokenHash): Promise<SessionEntity | null | Error> {
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
      return caught instanceof Error ? caught : new Error("failed to find System SessionEntity")
    }
  }

  async authenticate(
    command: Readonly<{ rawToken: string; now: Date }>,
    materialService: Readonly<{
      hashRawToken: (rawToken: string) => Promise<SessionTokenHash | Error>
    }>,
  ): Promise<SystemSessionAuthentication | Error> {
    if (!Number.isSafeInteger(command.now.getTime())) {
      return new Error("System Session authentication time is invalid")
    }

    const tokenHash = await materialService.hashRawToken(command.rawToken)
    if (tokenHash instanceof Error) return tokenHash
    const session = await this.findByTokenHash(tokenHash)
    if (session instanceof Error) return session
    if (session === null || session.getUseRejection(command.now) !== null) {
      return Object.freeze({ kind: "rejected" as const, reason: "invalid" as const })
    }

    const accountSession = await SystemAccountRepository.resolveSession({
      accountRepository: new SystemAccountRepository({ database: this.props.context.env.DB }),
      accountId: session.accountId,
      sessionTokenVersion: session.tokenVersion,
    })
    if (accountSession instanceof Error) return accountSession
    if (accountSession.kind === "rejected") {
      return Object.freeze({ kind: "rejected" as const, reason: "invalid" as const })
    }

    return Object.freeze({
      kind: "authenticated" as const,
      accountId: accountSession.account.id,
      tokenVersion: accountSession.account.tokenVersion,
      sessionId: session.id,
      expiresAt: session.expiresAt,
    })
  }

  async rotateWithAudit(
    rotation: SessionRotationValue,
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
        return new Error("audited System SessionEntity rotation did not succeed")
      }

      return parseSystemSessionRotationResult(results[0], audits)
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to rotate System SessionEntity")
    }
  }

  async revokeFamilyWithAudit(props: RevokeSessionFamilyProps): Promise<void | Error> {
    if (!Number.isFinite(props.revokedAt.getTime())) {
      return new Error("System SessionEntity family revocation time is invalid")
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
        : new Error("audited System SessionEntity family revocation did not succeed")
    } catch (caught) {
      return caught instanceof Error
        ? caught
        : new Error("failed to revoke System SessionEntity family")
    }
  }

  private prepareCreate(session: SessionEntity): D1PreparedStatement {
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
    rotation: SessionRotationValue,
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
    rotation: SessionRotationValue,
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
    rotation: SessionRotationValue,
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
