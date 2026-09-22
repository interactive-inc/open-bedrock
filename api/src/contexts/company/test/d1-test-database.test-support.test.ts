import { Database } from "bun:sqlite"
import { expect, spyOn, test } from "bun:test"
import { createCompanyD1TestDatabase } from "@/contexts/company/test/d1-test-database.test-support"

test("32 KiB 以上の同じ SQL は一度だけ適用し、更新を他の複製と後続呼び出しへ漏らさない", async () => {
  const schema = "CREATE TABLE records (id TEXT PRIMARY KEY);".padEnd(32 * 1024)
  const exec = spyOn(Database.prototype, "exec")

  try {
    const first = createCompanyD1TestDatabase(schema)
    const second = createCompanyD1TestDatabase(schema)
    await first.exec("INSERT INTO records VALUES ('first')")
    expect((await first.prepare("SELECT id FROM records").all()).results).toEqual([{ id: "first" }])
    expect((await second.prepare("SELECT id FROM records").all()).results).toEqual([])
    await second.exec("INSERT INTO records VALUES ('second')")
    const fresh = createCompanyD1TestDatabase(schema)
    expect((await fresh.prepare("SELECT id FROM records").all()).results).toEqual([])
    expect((await first.prepare("SELECT id FROM records").all()).results).toEqual([{ id: "first" }])
    expect(exec.mock.calls.filter((call) => call[0] === schema)).toHaveLength(1)

    const variant = `${schema}\nINSERT INTO records VALUES ('variant');`
    const different = createCompanyD1TestDatabase(variant)
    expect((await different.prepare("SELECT id FROM records").all()).results).toEqual([
      { id: "variant" },
    ])
    expect((await fresh.prepare("SELECT id FROM records").all()).results).toEqual([])
    expect(exec.mock.calls.filter((call) => call[0] === variant)).toHaveLength(1)
  } finally {
    exec.mockRestore()
  }
})

test.each(["ON", "OFF"])(
  "schema 適用後の foreign_keys=%s と他の接続設定を複製へ戻す",
  async (setting) => {
    const schema = `
    PRAGMA legacy_alter_table = ON;
    PRAGMA recursive_triggers = ON;
    CREATE TABLE parents (id TEXT PRIMARY KEY);
    CREATE TABLE children (id TEXT PRIMARY KEY, parent_id TEXT REFERENCES parents(id));
    PRAGMA foreign_keys = ${setting};
  `.padEnd(32 * 1024)

    for (const database of [
      createCompanyD1TestDatabase(schema),
      createCompanyD1TestDatabase(schema),
    ]) {
      expect(await database.prepare("PRAGMA foreign_keys").first<number>("foreign_keys")).toBe(
        setting === "ON" ? 1 : 0,
      )
      expect(
        await database.prepare("PRAGMA legacy_alter_table").first<number>("legacy_alter_table"),
      ).toBe(1)
      expect(
        await database.prepare("PRAGMA recursive_triggers").first<number>("recursive_triggers"),
      ).toBe(1)
      const insert = database.exec("INSERT INTO children VALUES ('child', 'missing')")
      if (setting === "ON") {
        await expect(insert).rejects.toThrow("FOREIGN KEY constraint failed")
      } else {
        await insert
        expect((await database.prepare("SELECT id FROM children").all()).results).toEqual([
          { id: "child" },
        ])
      }
    }
  },
)

test("失敗した大きい SQL はキャッシュせず、次の呼び出しでも適用して例外を返す", () => {
  const schema = "CREATE TABLE partial (id TEXT); INSERT INTO missing VALUES (1);".padEnd(32 * 1024)
  const exec = spyOn(Database.prototype, "exec")

  try {
    expect(() => createCompanyD1TestDatabase(schema)).toThrow("no such table: missing")
    expect(() => createCompanyD1TestDatabase(schema)).toThrow("no such table: missing")
    expect(exec.mock.calls.filter((call) => call[0] === schema)).toHaveLength(2)
  } finally {
    exec.mockRestore()
  }
})

test.each([128, 32 * 1024 - 1])(
  "短い SQL (%i 文字) は毎回適用し、TEMP table も利用できる",
  async (length) => {
    const schema = "CREATE TEMP TABLE temporary_records (id TEXT);".padEnd(length)
    const exec = spyOn(Database.prototype, "exec")

    try {
      const first = createCompanyD1TestDatabase(schema)
      const second = createCompanyD1TestDatabase(schema)
      expect(exec.mock.calls.filter((call) => call[0] === schema)).toHaveLength(2)
      expect(await first.prepare("PRAGMA foreign_keys").first<number>("foreign_keys")).toBe(1)
      await first.exec("INSERT INTO temporary_records VALUES ('first')")
      expect((await first.prepare("SELECT id FROM temporary_records").all()).results).toEqual([
        { id: "first" },
      ])
      expect((await second.prepare("SELECT id FROM temporary_records").all()).results).toEqual([])
    } finally {
      exec.mockRestore()
    }
  },
)

test("キャッシュは8件まで保持し、hit した SQL を残して最も古い未使用の SQL を追い出す", () => {
  const schemas = Array.from({ length: 9 }, (_, index) =>
    `CREATE TABLE lru_${index} (id TEXT);`.padEnd(32 * 1024),
  )
  const exec = spyOn(Database.prototype, "exec")

  try {
    for (const schema of schemas.slice(0, 8)) createCompanyD1TestDatabase(schema)
    createCompanyD1TestDatabase(schemas[0]!)
    createCompanyD1TestDatabase(schemas[8]!)
    createCompanyD1TestDatabase(schemas[0]!)
    createCompanyD1TestDatabase(schemas[1]!)
    expect(exec.mock.calls.filter((call) => call[0] === schemas[0])).toHaveLength(1)
    expect(exec.mock.calls.filter((call) => call[0] === schemas[1])).toHaveLength(2)
    expect(exec.mock.calls.filter((call) => call[0] === schemas[8])).toHaveLength(1)
  } finally {
    exec.mockRestore()
  }
})

test("Database を渡した場合は同じ接続を包み、既存の設定と TEMP table を維持する", async () => {
  const sqlite = new Database(":memory:")

  try {
    sqlite.exec("PRAGMA foreign_keys = OFF; CREATE TEMP TABLE existing (id TEXT);")
    const database = createCompanyD1TestDatabase(sqlite)
    await database.exec("INSERT INTO existing VALUES ('shared')")
    expect(sqlite.query("SELECT id FROM existing").all()).toEqual([{ id: "shared" }])
    expect(await database.prepare("PRAGMA foreign_keys").first<number>("foreign_keys")).toBe(0)
  } finally {
    sqlite.close()
  }
})
