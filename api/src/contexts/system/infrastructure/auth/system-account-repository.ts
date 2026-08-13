import type { AccountRepository } from "@system/application/auth/account-repository"
import type { AccountId } from "@system/domain/auth/account-id"
import { Account } from "@system/domain/auth/account.entity"
import { systemAccounts } from "@/contexts/system/infrastructure/schema/system-core"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/d1"

function createDatabase(database: D1Database) {
  return drizzle(database, { schema: { systemAccounts } })
}

type Props = Readonly<{
  database: D1Database | Pick<ReturnType<typeof createDatabase>, "select">
}>

/** canonical System Account tableだけを読むD1 repository。 */
export class SystemAccountRepository implements AccountRepository {
  constructor(private readonly props: Props) {
    Object.freeze(this)
  }

  async findById(accountId: AccountId): Promise<Account | null | Error> {
    try {
      const database =
        "select" in this.props.database ? this.props.database : createDatabase(this.props.database)
      const rows = await database
        .select()
        .from(systemAccounts)
        .where(eq(systemAccounts.id, accountId))
        .limit(1)
      const row = rows.at(0)

      return row === undefined ? null : Account.create(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to read System Account")
    }
  }
}
