import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { AccountEntity } from "@system/domain/entities/account.entity"
import { InvalidAccountError } from "@system/domain/errors"
import { SystemAccountRepository } from "@system/infrastructure/repositories/auth/system-account.repository"
import { createSystemD1TestDatabase } from "@system/test/create-system-d1-test-database.test-support"
import { describe, expect, test } from "bun:test"

const schema = `
  CREATE TABLE system_accounts (
    id TEXT PRIMARY KEY NOT NULL,
    status TEXT NOT NULL,
    token_version INTEGER NOT NULL,
    closed_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
`

function createRepository(database: D1Database): SystemAccountRepository {
  return new SystemAccountRepository({ database })
}

describe("SystemAccountRepository", () => {
  test("canonical rowを共通AccountEntityへ復元する", async () => {
    const database = createSystemD1TestDatabase(schema)
    await database
      .prepare(
        `INSERT INTO system_accounts
           (id, status, token_version, created_at, updated_at)
         VALUES ('account-1', 'suspended', 3, 100, 200)`,
      )
      .run()

    const account = await createRepository(database).findById(zAccountId.parse("account-1"))

    expect(account).toBeInstanceOf(AccountEntity)
    expect(account).toMatchObject({
      id: "account-1",
      status: "suspended",
      tokenVersion: 3,
      closedAt: null,
      createdAt: new Date(100),
      updatedAt: new Date(200),
    })
  })

  test("存在しないAccountEntityはnullを返す", async () => {
    const database = createSystemD1TestDatabase(schema)

    expect(await createRepository(database).findById(zAccountId.parse("missing"))).toBeNull()
  })

  test.each([
    ["disabled", 0, 100, 100],
    ["active", -1, 100, 100],
    ["active", 0, 200, 100],
  ] as const)(
    "壊れたcanonical rowをfail closedにする",
    async (status, tokenVersion, createdAt, updatedAt) => {
      const database = createSystemD1TestDatabase(schema)
      await database
        .prepare(
          `INSERT INTO system_accounts
             (id, status, token_version, created_at, updated_at)
           VALUES ('corrupt', ?1, ?2, ?3, ?4)`,
        )
        .bind(status, tokenVersion, createdAt, updatedAt)
        .run()

      const account = await createRepository(database).findById(zAccountId.parse("corrupt"))

      expect(account).toBeInstanceOf(InvalidAccountError)
    },
  )

  test("D1 query失敗をthrowせずErrorへ閉じる", async () => {
    const database = createSystemD1TestDatabase(schema)
    await database.exec("DROP TABLE system_accounts")

    const account = await createRepository(database).findById(zAccountId.parse("account-1"))

    expect(account).toBeInstanceOf(Error)
    expect(account).not.toBeInstanceOf(InvalidAccountError)
  })
})
