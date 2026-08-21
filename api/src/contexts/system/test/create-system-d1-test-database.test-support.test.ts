import { createSystemD1TestDatabase } from "@system/test/create-system-d1-test-database.test-support"
import { describe, expect, test } from "bun:test"

const schema = `
  CREATE TABLE records (
    id TEXT PRIMARY KEY NOT NULL,
    payload TEXT NOT NULL
  );
`

describe("createSystemD1TestDatabase", () => {
  test("prepareのrun・first・all・rawをD1形式の結果へ適応する", async () => {
    const database = createSystemD1TestDatabase(schema)
    const inserted = await database
      .prepare("INSERT INTO records (id, payload) VALUES (?1, ?2)")
      .bind("record-1", { enabled: true })
      .run()

    expect(inserted.meta.changes).toBe(1)
    expect(inserted.meta.rows_written).toBe(1)
    expect(inserted.meta.changed_db).toBe(true)
    expect(
      await database
        .prepare("SELECT payload FROM records WHERE id = ?1")
        .bind("record-1")
        .first<string>("payload"),
    ).toBe('{"enabled":true}')
    expect((await database.prepare("SELECT id FROM records").all()).results).toEqual([
      { id: "record-1" },
    ])
    expect(await database.prepare("SELECT id, payload FROM records").raw()).toEqual([
      ["record-1", '{"enabled":true}'],
    ])
  })

  test("batchを単一SQLite transactionとして確定する", async () => {
    const database = createSystemD1TestDatabase(schema)

    await database.batch([
      database.prepare("INSERT INTO records (id, payload) VALUES ('record-1', 'one')"),
      database.prepare("INSERT INTO records (id, payload) VALUES ('record-2', 'two')"),
    ])

    expect(
      await database.prepare("SELECT COUNT(*) AS count FROM records").first<number>("count"),
    ).toBe(2)
  })

  test("batchの途中失敗で先行statementもrollbackする", async () => {
    const database = createSystemD1TestDatabase(schema)
    let failure: unknown = null

    try {
      await database.batch([
        database.prepare("INSERT INTO records (id, payload) VALUES ('duplicate', 'first')"),
        database.prepare("INSERT INTO records (id, payload) VALUES ('duplicate', 'second')"),
      ])
    } catch (cause) {
      failure = cause
    }

    expect(failure).toBeInstanceOf(Error)
    expect(
      await database.prepare("SELECT COUNT(*) AS count FROM records").first<number>("count"),
    ).toBe(0)
  })
})
