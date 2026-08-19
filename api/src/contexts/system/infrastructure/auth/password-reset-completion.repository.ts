import type { SystemDatabaseContext } from "@system/infrastructure/configuration/system-context"
import type { WriteOperationEntity } from "@/lib/persistence/write-operation.entity"
import { PasswordResetCompletionWriteError } from "@/contexts/system/infrastructure/auth/errors"
import {
  passwordResetTokens,
  userIdentities,
  users,
} from "@/contexts/system/infrastructure/schema/system-runtime"
import { and, eq, exists, gte, isNull, or, sql } from "drizzle-orm"
import { alias } from "drizzle-orm/sqlite-core"
import { abortWhenPreviousDrizzleStatementChangedNoRows } from "@/contexts/system/infrastructure/auth/abort-when-previous-drizzle-statement-changed-no-rows"
import { prepareDrizzleAuditLogAppend } from "@/contexts/system/infrastructure/audit/prepare-drizzle-audit-log-append"

type Props = Readonly<{
  tokenId: string
  tokenIdentityId: string | null
  userId: string
  identityId: string
  passwordHash: string
  emailVerifiedAt: Date
  changedAt: Date
}>

export class PasswordResetCompletionRepository {
  constructor(private readonly c: SystemDatabaseContext) {}

  async write(
    entity: WriteOperationEntity<"complete", Props>,
  ): Promise<number | null | PasswordResetCompletionWriteError> {
    const props = entity.props
    try {
      const database = this.c.var.database
      const selectedToken = alias(passwordResetTokens, "selected_reset_token")
      const selectedTokenIsAvailable = database
        .select({ one: sql<number>`1` })
        .from(selectedToken)
        .where(
          and(
            eq(selectedToken.id, props.tokenId),
            eq(selectedToken.userId, props.userId),
            props.tokenIdentityId === null
              ? isNull(selectedToken.identityId)
              : eq(selectedToken.identityId, props.identityId),
            isNull(selectedToken.usedAt),
            gte(selectedToken.expiresAt, props.changedAt),
          ),
        )
        .limit(1)
      const targetIdentity = alias(userIdentities, "password_reset_target_identity")
      const targetIdentityExists = database
        .select({ one: sql<number>`1` })
        .from(targetIdentity)
        .where(
          and(
            eq(targetIdentity.id, props.identityId),
            eq(targetIdentity.userId, props.userId),
            eq(targetIdentity.provider, "password"),
          ),
        )
        .limit(1)
      const updateIdentity = database
        .update(userIdentities)
        .set({
          passwordHash: props.passwordHash,
          emailVerifiedAt: props.emailVerifiedAt,
          passwordChangedAt: props.changedAt,
          updatedAt: props.changedAt,
        })
        .where(
          and(
            eq(userIdentities.id, props.identityId),
            eq(userIdentities.userId, props.userId),
            eq(userIdentities.provider, "password"),
            exists(selectedTokenIsAvailable),
          ),
        )
        .returning({ id: userIdentities.id })
      const consumeIdentityTokens = database
        .update(passwordResetTokens)
        .set({ usedAt: props.changedAt })
        .where(
          and(
            eq(passwordResetTokens.userId, props.userId),
            isNull(passwordResetTokens.usedAt),
            or(
              eq(passwordResetTokens.identityId, props.identityId),
              isNull(passwordResetTokens.identityId),
            ),
            exists(selectedTokenIsAvailable),
            exists(targetIdentityExists),
          ),
        )
        .returning({ id: passwordResetTokens.id })
      const rotateAccountTokens = database
        .update(users)
        .set({ tokenVersion: sql`${users.tokenVersion} + 1`, updatedAt: props.changedAt })
        .where(
          and(
            eq(users.id, props.userId),
            exists(selectedTokenIsAvailable),
            exists(targetIdentityExists),
          ),
        )
        .returning({ tokenVersion: users.tokenVersion })
      const auditAppend = prepareDrizzleAuditLogAppend(database, {
        userId: props.userId,
        role: "unknown",
        action: "iam.account.password_reset",
        resourceType: "account",
        resourceId: props.userId,
        metadata: null,
        createdAt: props.changedAt,
      })

      const [updatedIdentities, , updatedAccounts, , consumedTokens] = await database.batch([
        updateIdentity,
        abortWhenPreviousDrizzleStatementChangedNoRows(database),
        rotateAccountTokens,
        abortWhenPreviousDrizzleStatementChangedNoRows(database),
        consumeIdentityTokens,
        abortWhenPreviousDrizzleStatementChangedNoRows(database),
        auditAppend,
        abortWhenPreviousDrizzleStatementChangedNoRows(database),
      ])

      const completed =
        updatedIdentities.length === 1 &&
        updatedAccounts.length === 1 &&
        consumedTokens.some((token) => token.id === props.tokenId)

      return completed ? (updatedAccounts[0]?.tokenVersion ?? null) : null
    } catch (cause) {
      return new PasswordResetCompletionWriteError(props.tokenId, cause)
    }
  }
}
