import type {
  PasswordCredentialRepository,
  SystemPasswordCredential,
} from "@system/application/auth/password-credential-repository"
import { Account } from "@system/domain/auth/account.entity"
import { IdentityBinding } from "@system/domain/identity/identity-binding.entity"
import type { IdentitySubject } from "@system/domain/identity/identity-subject"
import {
  systemAccounts,
  systemIdentityBindings,
  systemPasswordCredentials,
} from "@system/infrastructure/schema/system-core"
import { and, eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/d1"

function createDatabase(database: D1Database) {
  return drizzle(database, {
    schema: { systemAccounts, systemIdentityBindings, systemPasswordCredentials },
  })
}

type Props = Readonly<{
  database: D1Database | Pick<ReturnType<typeof createDatabase>, "select">
}>

/** canonical Identity/password credential/Accountを一つのDB snapshotとして復元する。 */
export class SystemPasswordCredentialRepository implements PasswordCredentialRepository {
  constructor(private readonly props: Props) {
    Object.freeze(this)
  }

  async findBySubject(subject: IdentitySubject): Promise<SystemPasswordCredential | null | Error> {
    try {
      const database =
        "select" in this.props.database ? this.props.database : createDatabase(this.props.database)
      const rows = await database
        .select({
          account: systemAccounts,
          identity: systemIdentityBindings,
          passwordHash: systemPasswordCredentials.passwordHash,
        })
        .from(systemIdentityBindings)
        .innerJoin(
          systemPasswordCredentials,
          eq(systemPasswordCredentials.identityId, systemIdentityBindings.id),
        )
        .innerJoin(systemAccounts, eq(systemAccounts.id, systemIdentityBindings.accountId))
        .where(
          and(
            eq(systemIdentityBindings.provider, "password"),
            eq(systemIdentityBindings.subject, subject),
          ),
        )
        .limit(1)
      const row = rows.at(0)

      if (row === undefined) return null
      const account = Account.create(row.account)
      if (account instanceof Error) return account
      const identity = IdentityBinding.create(row.identity)
      if (identity instanceof Error) return identity

      return Object.freeze({ account, identity, passwordHash: row.passwordHash })
    } catch (caught) {
      return caught instanceof Error
        ? caught
        : new Error("failed to find System password credential")
    }
  }
}
