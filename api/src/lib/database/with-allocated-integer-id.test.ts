import { describe, expect, test } from "bun:test"
import { withAllocatedIntegerId } from "@/lib/database/with-allocated-integer-id"

function databaseReturning(nextIds: ReadonlyArray<number>): {
  database: D1Database
  queries: Array<{ sql: string; values: ReadonlyArray<unknown> }>
} {
  const queries: Array<{ sql: string; values: ReadonlyArray<unknown> }> = []
  let index = 0
  const database = {
    prepare(sql: string) {
      return {
        bind(...values: ReadonlyArray<unknown>) {
          return {
            async first() {
              queries.push({ sql, values })
              const next = nextIds[index]
              index += 1
              return next
            },
          }
        },
      }
    },
  } as unknown as D1Database

  return { database, queries }
}

describe("withAllocatedIntegerId", () => {
  test("AUTOINCREMENTの既発行値と現存する最大IDの大きい方に1を足したIDで書き込む", async () => {
    const { database, queries } = databaseReturning([8])

    const written = await withAllocatedIntegerId(database, "expenses", async (id) => id)

    expect(written).toBe(8)
    expect(queries).toHaveLength(1)
    expect(queries[0]?.values).toEqual(["expenses"])
    expect(queries[0]?.sql).toContain("sqlite_sequence")
    expect(queries[0]?.sql).toContain("SELECT max(id) FROM expenses")
  })

  test("同じ表の主キー衝突だけを読み直して再試行する", async () => {
    const { database } = databaseReturning([3, 4])
    const attempts: Array<number> = []

    const written = await withAllocatedIntegerId(database, "expenses", async (id) => {
      attempts.push(id)
      if (id === 3) {
        throw new Error("D1_ERROR: UNIQUE constraint failed: expenses.id: SQLITE_CONSTRAINT")
      }
      return id
    })

    expect(written).toBe(4)
    expect(attempts).toEqual([3, 4])
  })

  test("他の一意制約違反や他の表の主キー衝突は再試行せずに返す", async () => {
    const { database } = databaseReturning([3, 4])
    const other = new Error("UNIQUE constraint failed: expense_procedure_bindings.request_key")
    const otherTable = new Error("UNIQUE constraint failed: expenses_archive.id")

    await expect(
      withAllocatedIntegerId(database, "expenses", async () => Promise.reject(other)),
    ).rejects.toBe(other)
    await expect(
      withAllocatedIntegerId(database, "expenses", async () => Promise.reject(otherTable)),
    ).rejects.toBe(otherTable)
  })

  test("再試行は3回までで打ち切る", async () => {
    const { database } = databaseReturning([1, 2, 3, 4])
    const conflict = new Error("UNIQUE constraint failed: expenses.id")
    let attempts = 0

    await expect(
      withAllocatedIntegerId(database, "expenses", async () => {
        attempts += 1
        throw conflict
      }),
    ).rejects.toBe(conflict)
    expect(attempts).toBe(3)
  })

  test("識別子として不正な表名を拒否する", async () => {
    const { database } = databaseReturning([1])

    await expect(
      withAllocatedIntegerId(database, "expenses; DROP TABLE expenses", async (id) => id),
    ).rejects.toThrow("table name")
  })
})
