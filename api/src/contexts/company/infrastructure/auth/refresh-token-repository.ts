import type { Context } from "@/env"
import {
  hasExactRefreshTokenRotationDecisions,
  parseRefreshTokenRotationDecision,
} from "@/contexts/system/domain/auth/refresh-token-rotation-decision"
import type { RefreshTokenRotationDecision } from "@/contexts/system/domain/auth/refresh-token-rotation-decision"
import type { AuditDecisionAppendFragment } from "@/contexts/company/infrastructure/company/audit/audit-event-repository"
import { refreshTokens } from "@/schema"
import { eq } from "drizzle-orm"

const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60

export type CreateRefreshTokenProps = Readonly<{
  accountId: number
  tokenHash: string
  familyId: string
  tokenVersion: number
  userAgent: string | null
  nowEpoch: number
}>

export type RotateRefreshTokenProps = Readonly<{
  tokenId: number
  oldTokenHash: string
  newTokenHash: string
  accountId: number
  employeeId: number
  familyId: string
  tokenVersion: number
  userAgent: string | null
  nowEpoch: number
  lifecycleAccess?: Readonly<{
    source: "lifecycle" | "legacy"
    businessDate: string | null
  }>
}>

type AuditAppendStatements = readonly [D1PreparedStatement, D1PreparedStatement]

function prepareRefreshTokenCreateInvariant(
  db: D1Database,
  props: CreateRefreshTokenProps,
): D1PreparedStatement {
  return db
    .prepare(
      `SELECT CASE WHEN EXISTS (
         SELECT 1
         FROM refresh_tokens
         WHERE account_id = ?1
           AND token_hash = ?2
           AND family_id = ?3
           AND token_version = ?4
           AND expires_at = ?5
           AND revoked_at IS NULL
           AND user_agent IS ?6
           AND created_at = ?7
       ) THEN 1 ELSE json_extract('', '$') END AS ok`,
    )
    .bind(
      props.accountId,
      props.tokenHash,
      props.familyId,
      props.tokenVersion,
      props.nowEpoch + REFRESH_TOKEN_TTL_SECONDS,
      props.userAgent,
      props.nowEpoch,
    )
}

function toRepositoryError(caught: unknown, message: string): Error {
  return caught instanceof Error ? caught : new Error(message)
}

function classifyPersistenceFailure(caught: unknown): string {
  const message = caught instanceof Error ? caught.message : ""

  if (/no such table|no such column/iu.test(message)) return "missing_schema"
  if (/unique constraint/iu.test(message)) return "unique_constraint"
  if (/foreign key constraint/iu.test(message)) return "foreign_key_constraint"
  if (/check constraint/iu.test(message)) return "check_constraint"
  if (/json(?:_extract)?|malformed json/iu.test(message)) return "invariant_guard"
  if (/audit.+(?:immutable|append-only)|audit employee context/iu.test(message)) {
    return "audit_invariant"
  }

  return "database_error"
}

/**
 * 認証永続化の失敗を、token・account・利用者情報を含めず運用ログへ残す。
 * D1の詳細messageはbinding値を含む可能性があるため出さず、安全な分類だけを記録する。
 */
function logAuthPersistenceFailure(operation: string, caught: unknown): void {
  console.error(
    JSON.stringify({
      event: "auth.persistence.failed",
      operation,
      errorType: caught instanceof Error ? caught.name : typeof caught,
      reason: classifyPersistenceFailure(caught),
    }),
  )
}

export class RefreshTokenRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async createWithAudit(
    props: CreateRefreshTokenProps,
    auditStatements: AuditAppendStatements,
  ): Promise<void | Error> {
    try {
      const db = this.c.env.DB

      const results = await db.batch([
        db
          .prepare(
            `INSERT INTO refresh_tokens
               (account_id, token_hash, family_id, token_version, expires_at,
                revoked_at, user_agent, created_at)
             SELECT ?1, ?2, ?3, ?4, ?5, NULL, ?6, ?7
             WHERE EXISTS (
               SELECT 1
               FROM system_accounts AS canonical_account
               WHERE canonical_account.id = CAST(?1 AS TEXT)
                 AND canonical_account.status = 'active'
                 AND canonical_account.token_version = ?4
             )
             RETURNING id`,
          )
          .bind(
            props.accountId,
            props.tokenHash,
            props.familyId,
            props.tokenVersion,
            props.nowEpoch + REFRESH_TOKEN_TTL_SECONDS,
            props.userAgent,
            props.nowEpoch,
          ),
        prepareRefreshTokenCreateInvariant(db, props),
        ...auditStatements,
      ])
      if (results.length !== 4 || results.some((result) => !result.success)) {
        throw new Error("audited refresh token creation did not succeed")
      }
    } catch (caught) {
      logAuthPersistenceFailure("refresh_token.create_with_audit", caught)
      return toRepositoryError(caught, "failed to create refresh token with audit")
    }
  }

  async findByHash(tokenHash: string): Promise<
    | {
        id: number
        accountId: number
        familyId: string
        tokenVersion: number
        expiresAt: number
        revokedAt: number | null
      }
    | null
    | Error
  > {
    try {
      const db = this.c.var.database

      const rows = await db
        .select({
          id: refreshTokens.id,
          accountId: refreshTokens.accountId,
          familyId: refreshTokens.familyId,
          tokenVersion: refreshTokens.tokenVersion,
          expiresAt: refreshTokens.expiresAt,
          revokedAt: refreshTokens.revokedAt,
        })
        .from(refreshTokens)
        .where(eq(refreshTokens.tokenHash, tokenHash))
        .limit(1)

      const row = rows.at(0)

      if (row === undefined) {
        return null
      }

      return {
        id: row.id,
        accountId: row.accountId,
        familyId: row.familyId,
        tokenVersion: row.tokenVersion,
        expiresAt: row.expiresAt,
        revokedAt: row.revokedAt,
      }
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to find refresh token")
    }
  }

  async rotateWithAudit(
    props: RotateRefreshTokenProps,
    audit: AuditDecisionAppendFragment<RefreshTokenRotationDecision>,
  ): Promise<RefreshTokenRotationDecision | Error> {
    try {
      if (!hasExactRefreshTokenRotationDecisions(audit.decisions)) {
        throw new Error("rotation audit decisions are invalid")
      }

      const db = this.c.env.DB

      const results = await db.batch([
        db
          .prepare(
            `INSERT INTO audit_batch_decisions (decision_id, decision_value)
             VALUES (
               ?1,
               COALESCE((
                 SELECT CASE
                   WHEN rt.revoked_at IS NOT NULL THEN 'reused'
                   WHEN a.id IS NULL
                     OR canonical_account.id IS NULL
                     OR canonical_account.status <> 'active'
                     OR canonical_account.token_version <> rt.token_version
                     OR canonical_account.token_version <> ?8
                     OR a.status <> 'active'
                     OR link.employee_id IS NULL
                     OR link.employee_id <> ?7
                     OR a.token_version <> rt.token_version
                     OR a.token_version <> ?8
                     OR e.id IS NULL
                     OR (
                       ?10 = 1 AND (
                         e.archived_at IS NOT NULL
                         OR NOT EXISTS (
                           SELECT 1
                           FROM employment_period_versions AS employment
                           WHERE employment.employee_id = e.id
                             AND employment.revision = (
                               SELECT MAX(candidate.revision)
                               FROM employment_period_versions AS candidate
                               WHERE candidate.period_id = employment.period_id
                             )
                             AND employment.is_void = 0
                             AND employment.starts_on <= ?11
                             AND (employment.ends_on IS NULL OR ?11 < employment.ends_on)
                         )
                       )
                     )
                     OR (?10 = 0 AND e.status = 'retired')
                   THEN 'invalid'
                   ELSE 'rotated'
                 END
                 FROM refresh_tokens AS rt
                 LEFT JOIN accounts AS a ON a.id = rt.account_id
                 LEFT JOIN system_accounts AS canonical_account
                   ON canonical_account.id = CAST(rt.account_id AS TEXT)
                 LEFT JOIN account_employee_links AS link ON link.account_id = a.id
                 LEFT JOIN employees AS e ON e.id = link.employee_id
                 WHERE rt.id = ?2
                   AND rt.token_hash = ?3
                   AND rt.account_id = ?4
                   AND rt.family_id = ?5
                   AND rt.token_version = ?6
                   AND rt.expires_at > ?9
               ), 'missing')
             )
             RETURNING decision_value`,
          )
          .bind(
            audit.decisionId,
            props.tokenId,
            props.oldTokenHash,
            props.accountId,
            props.familyId,
            props.tokenVersion,
            props.employeeId,
            props.tokenVersion,
            props.nowEpoch,
            props.lifecycleAccess?.source === "lifecycle" ? 1 : 0,
            props.lifecycleAccess?.businessDate ?? "",
          ),
        db
          .prepare(
            `UPDATE refresh_tokens
             SET revoked_at = ?1
             WHERE id = ?2
               AND token_hash = ?3
               AND revoked_at IS NULL
               AND EXISTS (
                 SELECT 1 FROM audit_batch_decisions
                 WHERE decision_id = ?4 AND decision_value = 'rotated'
               )`,
          )
          .bind(props.nowEpoch, props.tokenId, props.oldTokenHash, audit.decisionId),
        db
          .prepare(
            `INSERT INTO refresh_tokens
               (account_id, token_hash, family_id, token_version, expires_at,
                revoked_at, user_agent, created_at)
             SELECT rt.account_id, ?1, rt.family_id, rt.token_version, ?2, NULL, ?3, ?4
             FROM refresh_tokens AS rt
             JOIN audit_batch_decisions AS d
               ON d.decision_id = ?5 AND d.decision_value = 'rotated'
             WHERE rt.id = ?6
               AND rt.token_hash = ?7
               AND rt.revoked_at = ?4`,
          )
          .bind(
            props.newTokenHash,
            props.nowEpoch + REFRESH_TOKEN_TTL_SECONDS,
            props.userAgent,
            props.nowEpoch,
            audit.decisionId,
            props.tokenId,
            props.oldTokenHash,
          ),
        db
          .prepare(
            `UPDATE refresh_tokens
             SET revoked_at = ?1
             WHERE family_id = ?2
               AND revoked_at IS NULL
               AND EXISTS (
                 SELECT 1 FROM audit_batch_decisions
                 WHERE decision_id = ?3
                   AND decision_value IN ('reused', 'invalid')
               )`,
          )
          .bind(props.nowEpoch, props.familyId, audit.decisionId),
        db
          .prepare(
            `SELECT CASE WHEN COALESCE((
               SELECT CASE d.decision_value
                 WHEN 'rotated' THEN
                   (SELECT COUNT(*) FROM refresh_tokens
                     WHERE id = ?2 AND token_hash = ?3 AND revoked_at = ?4) = 1
                   AND
                   (SELECT COUNT(*) FROM refresh_tokens
                     WHERE family_id = ?5 AND revoked_at IS NULL) = 1
                   AND
                   EXISTS (SELECT 1 FROM refresh_tokens
                     WHERE token_hash = ?6 AND family_id = ?5 AND revoked_at IS NULL)
                 WHEN 'reused' THEN
                   NOT EXISTS (SELECT 1 FROM refresh_tokens
                     WHERE family_id = ?5 AND revoked_at IS NULL)
                 WHEN 'invalid' THEN
                   NOT EXISTS (SELECT 1 FROM refresh_tokens
                     WHERE family_id = ?5 AND revoked_at IS NULL)
                 ELSE 0
               END
               FROM audit_batch_decisions AS d
               WHERE d.decision_id = ?1
             ), 0) = 1
             THEN 1 ELSE json_extract('', '$') END AS ok`,
          )
          .bind(
            audit.decisionId,
            props.tokenId,
            props.oldTokenHash,
            props.nowEpoch,
            props.familyId,
            props.newTokenHash,
          ),
        ...audit.statements,
      ])

      if (
        results.length !== 5 + audit.statements.length ||
        results.some((result) => !result.success)
      ) {
        throw new Error("audited refresh token rotation did not succeed")
      }
      const decisionRows = results[0]?.results
      if (!Array.isArray(decisionRows) || decisionRows.length !== 1) {
        throw new Error("rotation decision result is invalid")
      }
      const row = decisionRows[0]
      if (typeof row !== "object" || row === null || Array.isArray(row)) {
        throw new Error("rotation decision row is invalid")
      }
      const decision = parseRefreshTokenRotationDecision(
        (row as Record<string, unknown>).decision_value,
      )
      if (decision === null) throw new Error("rotation decision value is invalid")

      return decision
    } catch (caught) {
      return toRepositoryError(caught, "failed to rotate refresh token with audit")
    }
  }

  async revokeFamilyWithAudit(props: {
    familyId: string
    nowEpoch: number
    auditStatements: AuditAppendStatements
  }): Promise<void | Error> {
    try {
      const db = this.c.env.DB

      const results = await db.batch([
        db
          .prepare(
            `UPDATE refresh_tokens
             SET revoked_at = ?1
             WHERE family_id = ?2 AND revoked_at IS NULL`,
          )
          .bind(props.nowEpoch, props.familyId),
        ...props.auditStatements,
      ])
      if (results.length !== 3 || results.some((result) => !result.success)) {
        throw new Error("audited refresh token family revocation did not succeed")
      }
    } catch (caught) {
      return toRepositoryError(caught, "failed to revoke token family with audit")
    }
  }
}
