import type { IamIdentityEntity } from "@/contexts/system/domain/identity/iam-identity.entity"
import type { PasswordResetTokenEntity } from "@/contexts/system/domain/auth/password-reset-token.entity"
import {
  entityWriteState,
  type EntityWithWriteState,
} from "@/lib/persistence/entity-write-state.service"
import { type DeletionEntity, WriteOperationEntity } from "@/lib/persistence/write-operation.entity"
import {
  IamIdentityDuplicateError,
  IamIdentityWriteError,
} from "@/contexts/system/infrastructure/iam/errors"
import type { SystemDatabaseContext } from "@system/infrastructure/configuration/system-context"
import {
  passwordResetTokens,
  userIdentities,
} from "@/contexts/system/infrastructure/schema/system-runtime"
import { and, eq, exists, isNotNull, ne, or, sql } from "drizzle-orm"
import { alias } from "drizzle-orm/sqlite-core"

type IamIdentityWriteEntity = EntityWithWriteState<
  IamIdentityEntity,
  Readonly<{ passwordResetTokenEntity: PasswordResetTokenEntity }>
>

export class IamIdentityRepository {
  constructor(private readonly c: SystemDatabaseContext) {}

  async write(
    entity: IamIdentityWriteEntity,
  ): Promise<IamIdentityEntity | IamIdentityDuplicateError | IamIdentityWriteError>
  async write(entity: DeletionEntity<IamIdentityEntity>): Promise<boolean | IamIdentityWriteError>
  async write(
    entity: IamIdentityWriteEntity | DeletionEntity<IamIdentityEntity>,
  ): Promise<unknown> {
    if (entity instanceof WriteOperationEntity) {
      return this.deleteEntity(entity.props.entity)
    }

    const { passwordResetTokenEntity } = entityWriteState(entity)

    try {
      await this.c.var.database.batch([
        this.c.var.database.insert(userIdentities).values({
          id: entity.id,
          userId: entity.userId,
          provider: entity.provider,
          providerSubject: entity.providerSubject,
          email: entity.email,
          passwordHash: entity.passwordHash,
          canReceiveEmail: entity.canReceiveEmail,
          emailVerifiedAt: entity.emailVerifiedAt,
          passwordChangedAt: entity.passwordChangedAt,
          createdAt: entity.createdAt,
          updatedAt: entity.updatedAt,
        }),
        this.c.var.database.insert(passwordResetTokens).values({
          id: passwordResetTokenEntity.id,
          token: passwordResetTokenEntity.token,
          userId: passwordResetTokenEntity.userId,
          identityId: passwordResetTokenEntity.identityId,
          expiresAt: passwordResetTokenEntity.expiresAt,
          usedAt: passwordResetTokenEntity.usedAt,
          createdAt: passwordResetTokenEntity.createdAt,
        }),
      ])

      return entity
    } catch (cause) {
      if (cause instanceof Error && cause.message.includes("UNIQUE")) {
        return new IamIdentityDuplicateError(cause)
      }

      return new IamIdentityWriteError("save", entity.id, cause)
    }
  }

  private async deleteEntity(entity: IamIdentityEntity) {
    try {
      const configuredSibling = alias(userIdentities, "configured_login_sibling")
      const anotherConfiguredLogin = this.c.var.database
        .select({ one: sql<number>`1` })
        .from(configuredSibling)
        .where(
          and(
            eq(configuredSibling.userId, entity.userId),
            ne(configuredSibling.id, entity.id),
            or(
              ne(configuredSibling.provider, "password"),
              isNotNull(configuredSibling.passwordHash),
            ),
          ),
        )
        .limit(1)
      const target = and(eq(userIdentities.id, entity.id), eq(userIdentities.userId, entity.userId))
      const deletedRows = await this.c.var.database
        .delete(userIdentities)
        .where(and(target, exists(anotherConfiguredLogin)))
        .returning({ id: userIdentities.id })

      if (deletedRows.length > 0) {
        return true
      }

      const stillExists = await this.c.var.database
        .select({ id: userIdentities.id })
        .from(userIdentities)
        .where(target)
        .limit(1)

      return stillExists.length === 0
    } catch (cause) {
      return new IamIdentityWriteError("delete", entity.id, cause)
    }
  }
}
