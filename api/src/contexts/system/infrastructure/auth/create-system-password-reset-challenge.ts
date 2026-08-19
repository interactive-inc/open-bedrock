import type { PasswordResetTokenHash } from "@system/domain/auth/password-reset-token-hash"
import { createSystemAuditEvent } from "@system/domain/audit/create-system-audit-event"
import { SystemAuditEventRepository } from "@system/infrastructure/audit/system-audit-event-repository"
import type { SystemD1Context } from "@system/infrastructure/configuration/system-context"

type Props = Readonly<{
  id: string
  tokenHash: PasswordResetTokenHash
  accountId: string
  identityId: string
  createdAt: Date
  expiresAt: Date
  metadataJson: string | null
}>

/** 既存challengeを失効し、新challengeと監査を同じD1 batchで確定する。 */
export async function createSystemPasswordResetChallenge(
  context: SystemD1Context,
  props: Props,
): Promise<void | Error> {
  const audit = createSystemAuditEvent({
    actorAccountId: null,
    action: "auth.password_reset.requested",
    targetType: "account",
    targetId: props.accountId,
    outcome: "succeeded",
    reasonCode: null,
    authorizationJson: null,
    beforeJson: null,
    afterJson: null,
    metadataJson: props.metadataJson,
    occurredAt: props.createdAt,
  })
  if (audit instanceof Error) return audit

  try {
    const database = context.env.DB
    const createdAt = props.createdAt.getTime()
    const expiresAt = props.expiresAt.getTime()
    const statements = [
      database
        .prepare(
          `UPDATE system_password_reset_challenges
           SET used_at = max(created_at, ?1)
           WHERE account_id = ?2 AND identity_id = ?3 AND used_at IS NULL`,
        )
        .bind(createdAt, props.accountId, props.identityId),
      database
        .prepare(
          `INSERT INTO system_password_reset_challenges
             (id, token_hash, account_id, identity_id, created_at, expires_at, used_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL)`,
        )
        .bind(props.id, props.tokenHash, props.accountId, props.identityId, createdAt, expiresAt),
      ...new SystemAuditEventRepository(context).prepareAppend(audit),
      database
        .prepare(
          `SELECT CASE WHEN
             (SELECT count(*) FROM system_password_reset_challenges
              WHERE account_id = ?1 AND identity_id = ?2 AND used_at IS NULL) = 1
             AND EXISTS (
               SELECT 1 FROM system_password_reset_challenges
               WHERE id = ?3 AND token_hash = ?4 AND account_id = ?1 AND identity_id = ?2
                 AND created_at = ?5 AND expires_at = ?6 AND used_at IS NULL
             )
           THEN 1 ELSE json_extract('', '$') END AS ok`,
        )
        .bind(props.accountId, props.identityId, props.id, props.tokenHash, createdAt, expiresAt),
    ]
    const batchResults = await database.batch(statements)

    return batchResults.length === statements.length && batchResults.every((entry) => entry.success)
      ? undefined
      : new Error("password reset challenge creation did not succeed")
  } catch (caught) {
    return caught instanceof Error ? caught : new Error("failed to create password reset challenge")
  }
}
