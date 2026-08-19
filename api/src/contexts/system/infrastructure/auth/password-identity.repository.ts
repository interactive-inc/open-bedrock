import { PasswordIdentityWriteError } from "@/contexts/system/infrastructure/auth/errors"
import type { WriteOperationEntity } from "@/lib/persistence/write-operation.entity"
import type { SystemDatabaseContext } from "@system/infrastructure/configuration/system-context"
import { userIdentities, users } from "@/contexts/system/infrastructure/schema/system-runtime"
import { and, eq, isNull, sql } from "drizzle-orm"
import { abortWhenPreviousDrizzleStatementChangedNoRows } from "@/contexts/system/infrastructure/auth/abort-when-previous-drizzle-statement-changed-no-rows"
import { prepareDrizzleAuditLogAppend } from "@/contexts/system/infrastructure/audit/prepare-drizzle-audit-log-append"
import type { SystemAuditJsonValue } from "@system/domain/audit/system-audit-json-value"

type PasswordWriteProps = Readonly<{
  identityId: string
  passwordHash: string
  writtenAt: Date
}>
type PasswordAndAccountWriteProps = PasswordWriteProps &
  Readonly<{
    accountId: string
    actorAccountId: string
    auditRole: string
  }>
type AtomicPasswordWriteOperation =
  | "change_password"
  | "issue_initial_password"
  | "set_initial_password_if_unset"
type PasswordIdentityWriteEntity =
  | WriteOperationEntity<AtomicPasswordWriteOperation, PasswordAndAccountWriteProps>
  | WriteOperationEntity<"rehash_password", PasswordWriteProps>

export class PasswordIdentityRepository {
  constructor(private readonly c: SystemDatabaseContext) {}

  async write(
    entity: WriteOperationEntity<AtomicPasswordWriteOperation, PasswordAndAccountWriteProps>,
  ): Promise<number | PasswordIdentityWriteError>
  async write(entity: PasswordIdentityWriteEntity): Promise<void | PasswordIdentityWriteError>
  async write(entity: PasswordIdentityWriteEntity) {
    if (entity.operation === "rehash_password") {
      return this.rehashPassword(entity.props)
    }

    return this.writePasswordAndAccount(entity.operation, entity.props)
  }

  private async rehashPassword(
    props: PasswordWriteProps,
  ): Promise<void | PasswordIdentityWriteError> {
    try {
      await this.c.var.database
        .update(userIdentities)
        .set({ passwordHash: props.passwordHash, updatedAt: props.writtenAt })
        .where(eq(userIdentities.id, props.identityId))

      return undefined
    } catch (cause) {
      return new PasswordIdentityWriteError("rehash_password", props.identityId, cause)
    }
  }

  private async writePasswordAndAccount(
    operation: AtomicPasswordWriteOperation,
    props: PasswordAndAccountWriteProps,
  ): Promise<number | PasswordIdentityWriteError> {
    try {
      const database = this.c.var.database
      const operationPolicy = passwordWritePolicy(operation)
      const updatedIdentities = database
        .update(userIdentities)
        .set({
          passwordHash: props.passwordHash,
          passwordChangedAt: props.writtenAt,
          updatedAt: props.writtenAt,
        })
        .where(
          and(
            eq(userIdentities.id, props.identityId),
            eq(userIdentities.userId, props.accountId),
            eq(userIdentities.provider, "password"),
            ...(operationPolicy.passwordMustBeUnset ? [isNull(userIdentities.passwordHash)] : []),
          ),
        )
        .returning({ id: userIdentities.id })
      const updatedUsers = database
        .update(users)
        .set({
          tokenVersion: sql`${users.tokenVersion} + 1`,
          updatedAt: props.writtenAt,
        })
        .where(eq(users.id, props.accountId))
        .returning({ tokenVersion: users.tokenVersion })
      const auditAppend = prepareDrizzleAuditLogAppend(database, {
        userId: props.actorAccountId,
        role: props.auditRole,
        action: operationPolicy.auditAction,
        resourceType: "account",
        resourceId: props.accountId,
        metadata: operationPolicy.auditMetadata,
        createdAt: props.writtenAt,
      })

      const [, , accountRows] = await database.batch([
        updatedIdentities,
        abortWhenPreviousDrizzleStatementChangedNoRows(database),
        updatedUsers,
        abortWhenPreviousDrizzleStatementChangedNoRows(database),
        auditAppend,
        abortWhenPreviousDrizzleStatementChangedNoRows(database),
      ])

      const updatedUser = accountRows[0]
      if (updatedUser === undefined) {
        return new PasswordIdentityWriteError(
          operation,
          props.identityId,
          new Error("account not found while rotating token version"),
        )
      }

      return updatedUser.tokenVersion
    } catch (cause) {
      return new PasswordIdentityWriteError(operation, props.identityId, cause)
    }
  }
}

type PasswordWritePolicy = Readonly<{
  passwordMustBeUnset: boolean
  auditAction: "iam.account.password_changed" | "iam.account.password_reset"
  auditMetadata: Readonly<Record<string, SystemAuditJsonValue>> | null
}>

/** 操作名を監査語彙と競合条件へ閉じて、呼び出し側から任意の監査actionを注入させない。 */
function passwordWritePolicy(operation: AtomicPasswordWriteOperation): PasswordWritePolicy {
  if (operation === "change_password") {
    return {
      passwordMustBeUnset: false,
      auditAction: "iam.account.password_changed",
      auditMetadata: null,
    }
  }

  return {
    passwordMustBeUnset: operation === "set_initial_password_if_unset",
    auditAction: "iam.account.password_reset",
    auditMetadata: {
      source:
        operation === "issue_initial_password" ? "initial_password_issue" : "initial_password_sync",
    },
  }
}
