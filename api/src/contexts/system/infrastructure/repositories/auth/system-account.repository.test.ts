import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { AccountEntity } from "@system/domain/entities/account.entity"
import { InvalidAccountError } from "@system/domain/errors"
import { SystemAccountRepository } from "@system/infrastructure/repositories/auth/system-account.repository"
import { createSystemD1TestDatabase } from "@system/test/create-system-d1-test-database.test-support"
import { describe, expect, spyOn, test } from "bun:test"

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
  test("千件を超えるIDを一度の照会で読み、停止状態・欠損・重複IDを区別する", async () => {
    let queries = 0
    const database = createSystemD1TestDatabase(schema, {
      onQuery: () => {
        queries += 1
      },
    })
    const ids = Array.from({ length: 1001 }, (_, index) => zAccountId.parse(`account-${index}`))
    await database
      .prepare(`INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
      SELECT value, 'active', 0, 0, 0 FROM json_each(?1)`)
      .bind(JSON.stringify(ids))
      .run()
    await database
      .prepare("UPDATE system_accounts SET status = 'locked' WHERE id = ?1")
      .bind(ids[0])
      .run()
    await database
      .prepare("UPDATE system_accounts SET status = 'suspended' WHERE id = ?1")
      .bind(ids[1])
      .run()
    const prepare = database.prepare.bind(database)
    let maximumParameters = 0
    const intercepted = spyOn(database, "prepare").mockImplementation((query) => {
      const statement = prepare(query)
      const bind = statement.bind.bind(statement)
      statement.bind = (...values: unknown[]) => {
        maximumParameters = Math.max(maximumParameters, values.length)
        if (values.length > 100) throw new Error("D1 bound parameter limit exceeded")
        return bind(...values)
      }
      return statement
    })
    queries = 0
    try {
      const accounts = await createRepository(database).findMany([
        ...ids,
        ids[0]!,
        zAccountId.parse("missing"),
      ])
      if (accounts instanceof Error) throw accounts
      expect(accounts).toHaveLength(1001)
      expect(accounts.filter((account) => account.status === "active")).toHaveLength(999)
      expect(accounts.find((account) => account.id === ids[0])?.status).toBe("locked")
      expect(accounts.find((account) => account.id === ids[1])?.status).toBe("suspended")
      expect(queries).toBe(1)
      expect(maximumParameters).toBe(1)
    } finally {
      intercepted.mockRestore()
    }
  })

  test("空の一括参照はDBを読まず、不正な保存値や読み取り失敗で部分結果を返さない", async () => {
    let queries = 0
    const database = createSystemD1TestDatabase(schema, {
      onQuery: () => {
        queries += 1
      },
    })
    expect(await createRepository(database).findMany([])).toEqual([])
    expect(queries).toBe(0)
    await database.exec(`INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
      VALUES ('valid', 'active', 0, 0, 0), ('corrupt', 'disabled', 0, 0, 0)`)
    expect(
      await createRepository(database).findMany([
        zAccountId.parse("valid"),
        zAccountId.parse("corrupt"),
      ]),
    ).toBeInstanceOf(InvalidAccountError)
    await database.exec("DROP TABLE system_accounts")
    expect(await createRepository(database).findMany([zAccountId.parse("valid")])).toBeInstanceOf(
      Error,
    )
  })

  test("canonical rowを共通AccountEntityへ復元する", async () => {
    const database = createSystemD1TestDatabase(schema)
    await database
      .prepare(
        `INSERT INTO system_accounts
           (id, status, token_version, created_at, updated_at)
         VALUES ('account-1', 'suspended', 3, 100, 200)`,
      )
      .run()

    const account = await createRepository(database).find(zAccountId.parse("account-1"))

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

    expect(await createRepository(database).find(zAccountId.parse("missing"))).toBeNull()
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

      const account = await createRepository(database).find(zAccountId.parse("corrupt"))

      expect(account).toBeInstanceOf(InvalidAccountError)
    },
  )

  test("D1 query失敗をthrowせずErrorへ閉じる", async () => {
    const database = createSystemD1TestDatabase(schema)
    await database.exec("DROP TABLE system_accounts")

    const account = await createRepository(database).find(zAccountId.parse("account-1"))

    expect(account).toBeInstanceOf(Error)
    expect(account).not.toBeInstanceOf(InvalidAccountError)
  })
})
