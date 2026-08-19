import {
  PasswordIdentityReadError,
  PasswordIdentityWriteError,
} from "@/contexts/system/infrastructure/auth/password-identity/errors"
import type { SystemDatabaseContext } from "@system/infrastructure/configuration/system-context"
import { identitySubjectSchema } from "@system/domain/identity/identity-subject"
import { userIdentities, users } from "@/contexts/system/infrastructure/schema/system-runtime"
import { and, asc, eq, getTableColumns } from "drizzle-orm"

const passwordIdentitySelection = {
  ...getTableColumns(userIdentities),
  user: {
    id: users.id,
    name: users.name,
    disabledAt: users.disabledAt,
    tokenVersion: users.tokenVersion,
  },
}

export class PasswordIdentityGateway {
  constructor(private readonly c: SystemDatabaseContext) {}

  async findByProviderSubject(identifier: string) {
    try {
      const subject = identitySubjectSchema.safeParse(identifier)

      if (!subject.success) {
        return undefined
      }

      const [identity] = await this.c.var.database
        .select(passwordIdentitySelection)
        .from(userIdentities)
        .innerJoin(users, eq(users.id, userIdentities.userId))
        .where(
          and(
            eq(userIdentities.provider, "password"),
            eq(userIdentities.providerSubject, subject.data),
          ),
        )
        .limit(1)

      return identity
    } catch (cause) {
      return new PasswordIdentityReadError(identifier, cause)
    }
  }

  async findByUserId(userId: string) {
    try {
      const [identity] = await this.c.var.database
        .select(passwordIdentitySelection)
        .from(userIdentities)
        .innerJoin(users, eq(users.id, userIdentities.userId))
        .where(and(eq(userIdentities.provider, "password"), eq(userIdentities.userId, userId)))
        .orderBy(asc(userIdentities.createdAt), asc(userIdentities.id))
        .limit(1)

      return identity
    } catch (cause) {
      return new PasswordIdentityReadError(userId, cause)
    }
  }

  async updatePasswordHash(identityId: string, passwordHash: string, updatedAt: Date) {
    try {
      await this.c.var.database
        .update(userIdentities)
        .set({ passwordHash, updatedAt })
        .where(eq(userIdentities.id, identityId))

      return undefined
    } catch (cause) {
      return new PasswordIdentityWriteError(identityId, cause)
    }
  }
}
