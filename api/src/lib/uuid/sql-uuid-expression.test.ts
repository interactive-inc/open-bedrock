import { SQL_UUID_V4_EXPRESSION } from "@/lib/uuid/sql-uuid-expression"
import { uuidCheckPredicate, uuidSchema } from "@/lib/uuid/uuid.schema"
import { Database } from "bun:sqlite"
import { describe, expect, test } from "bun:test"

describe("SQL_UUID_V4_EXPRESSION", () => {
  /** CHECK 制約付きの表へ式で採番した行を入れ、通った値を返す。 */
  function generate(count: number): string[] {
    const database = new Database(":memory:")
    database.run(`CREATE TABLE t (id TEXT NOT NULL, CHECK (${uuidCheckPredicate("id")}))`)

    for (let index = 0; index < count; index += 1) {
      database.run(`INSERT INTO t (id) VALUES (${SQL_UUID_V4_EXPRESSION})`)
    }

    return database
      .query<{ id: string }, []>("SELECT id FROM t")
      .all()
      .map((row) => row.id)
  }

  test("採番した値は CHECK 制約を必ず通る", () => {
    // CHECK に落ちれば INSERT が例外を投げるので、件数が揃えば通っている。
    expect(generate(2_000)).toHaveLength(2_000)
  })

  test("採番した値は uuidSchema も通る", () => {
    expect(generate(2_000).every((value) => uuidSchema.safeParse(value).success)).toBe(true)
  })

  test("version は 4、variant は 0b10 になる", () => {
    const values = generate(2_000)

    expect(values.every((value) => value[14] === "4")).toBe(true)
    expect(values.every((value) => ["8", "9", "a", "b"].includes(value[19] as string))).toBe(true)
  })

  test("重複しない", () => {
    const values = generate(2_000)

    expect(new Set(values).size).toBe(values.length)
  })
})
