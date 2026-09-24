import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { type LocalD1, startLocalD1 } from "@tests/d1/support/start-local-d1"

const schema = [
  "CREATE TABLE parents (id INTEGER PRIMARY KEY)",
  `CREATE TABLE children (
    id INTEGER PRIMARY KEY,
    parent_id INTEGER NOT NULL REFERENCES parents(id),
    name TEXT NOT NULL UNIQUE,
    note TEXT,
    payload BLOB,
    flag INTEGER,
    version INTEGER NOT NULL DEFAULT 0
  )`,
]

let local: LocalD1

async function databaseFor(name: string): Promise<D1Database> {
  const database = await local.database(name)
  await database.batch(schema.map((statement) => database.prepare(statement)))
  await database.prepare("INSERT INTO parents (id) VALUES (1)").run()
  return database
}

function insertChild(database: D1Database, name: string): D1PreparedStatement {
  return database.prepare("INSERT INTO children (parent_id, name) VALUES (1, ?1)").bind(name)
}

async function countChildren(database: D1Database): Promise<number> {
  const row = await database.prepare("SELECT count(*) AS count FROM children").first<{
    count: number
  }>()
  return row?.count ?? -1
}

async function failureOf(operation: Promise<unknown>): Promise<string> {
  return operation.then(
    () => "",
    (error: unknown) => (error instanceof Error ? error.message : String(error)),
  )
}

beforeAll(async () => {
  local = await startLocalD1([
    "batch-meta",
    "batch-rollback",
    "constraints",
    "bind-types",
    "number-into-text",
    "returning",
    "conditional-update",
  ])
})

afterAll(async () => {
  await local.dispose()
})

describe("local D1 contract used by repositories", () => {
  test("batch returns per-statement write meta on success", async () => {
    const database = await databaseFor("batch-meta")

    const results = await database.batch([
      insertChild(database, "first"),
      insertChild(database, "second"),
    ])

    expect(results.map((result) => result.meta.changes)).toEqual([1, 1])
    expect(results.map((result) => result.meta.changed_db)).toEqual([true, true])
    expect(results.map((result) => result.meta.last_row_id)).toEqual([1, 2])
    expect(await countChildren(database)).toBe(2)
  })

  test("batch rolls back every statement when a later statement fails", async () => {
    const database = await databaseFor("batch-rollback")
    await insertChild(database, "existing").run()

    const failure = await failureOf(
      database.batch([insertChild(database, "new"), insertChild(database, "existing")]),
    )

    expect(failure).toContain("UNIQUE constraint failed")
    expect(await countChildren(database)).toBe(1)
  })

  test("unique and foreign key constraints reject a single statement", async () => {
    const database = await databaseFor("constraints")
    await insertChild(database, "taken").run()

    const unique = await failureOf(insertChild(database, "taken").run())
    const foreignKey = await failureOf(
      database.prepare("INSERT INTO children (parent_id, name) VALUES (99, 'orphan')").run(),
    )

    expect(unique).toContain("UNIQUE constraint failed")
    expect(foreignKey).toContain("FOREIGN KEY constraint failed")
    expect(await countChildren(database)).toBe(1)
  })

  test("bind stores null, blob, boolean and number with their SQLite types", async () => {
    const database = await databaseFor("bind-types")

    await database
      .prepare(
        "INSERT INTO children (parent_id, name, note, payload, flag, version) VALUES (1, ?1, ?2, ?3, ?4, ?5)",
      )
      .bind("typed", null, new Uint8Array([1, 2, 255]), true, 3)
      .run()
    const row = await database
      .prepare(
        `SELECT note, payload, flag, version,
          typeof(note) AS note_type, typeof(payload) AS payload_type,
          typeof(flag) AS flag_type, typeof(version) AS version_type
         FROM children WHERE name = 'typed'`,
      )
      .first()

    expect(row).toEqual({
      note: null,
      payload: [1, 2, 255],
      flag: 1,
      version: 3,
      note_type: "null",
      payload_type: "blob",
      flag_type: "integer",
      version_type: "integer",
    })
  })

  test("a number bound to a TEXT column is stored as REAL text", async () => {
    const database = await databaseFor("number-into-text")

    await database
      .prepare("INSERT INTO children (parent_id, name, note) VALUES (1, 'numeric', ?1)")
      .bind(99)
      .run()
    const matchesInteger = await database
      .prepare("SELECT count(*) AS count FROM children WHERE note = ?1")
      .bind("99")
      .first<number>("count")

    expect(
      await database
        .prepare("SELECT note FROM children WHERE name = 'numeric'")
        .first<string>("note"),
    ).toBe("99.0")
    expect(matchesInteger).toBe(0)
  })

  test("RETURNING yields the written row with write meta", async () => {
    const database = await databaseFor("returning")

    const result = await database
      .prepare("INSERT INTO children (parent_id, name) VALUES (1, ?1) RETURNING id, name, version")
      .bind("returned")
      .all<{ id: number; name: string; version: number }>()

    expect(result.results).toEqual([{ id: 1, name: "returned", version: 0 }])
    expect(result.meta.changes).toBe(1)
  })

  test("conditional update reports zero changes for a stale version", async () => {
    const database = await databaseFor("conditional-update")
    await insertChild(database, "versioned").run()
    const update = database.prepare(
      "UPDATE children SET version = version + 1 WHERE name = 'versioned' AND version = ?1",
    )

    const current = await update.bind(0).run()
    const stale = await update.bind(0).run()

    expect(current.meta.changes).toBe(1)
    expect(stale.meta.changes).toBe(0)
    expect(
      await database
        .prepare("SELECT version FROM children WHERE name = 'versioned'")
        .first<number>("version"),
    ).toBe(1)
  })
})
