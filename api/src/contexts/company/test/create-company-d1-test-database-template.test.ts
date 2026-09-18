import { expect, test } from "bun:test"
import { createCompanyD1TestDatabaseTemplate } from "@/contexts/company/test/create-company-d1-test-database-template.test-support"

const schemaSql = `
  PRAGMA legacy_alter_table = OFF;
  PRAGMA recursive_triggers = ON;
  CREATE TABLE parents (id TEXT PRIMARY KEY);
  CREATE TABLE children (id TEXT PRIMARY KEY, parent_id TEXT REFERENCES parents(id));
  INSERT INTO parents VALUES ('seed');
`

test("コピーの更新・trigger・close は他のコピーとテンプレートに漏れない", async () => {
  const createDatabase = createCompanyD1TestDatabaseTemplate(schemaSql)
  const first = createDatabase()
  const second = createDatabase()

  try {
    await first.exec(`
      UPDATE parents SET id = 'changed';
      CREATE TRIGGER reject_parent BEFORE INSERT ON parents
      BEGIN SELECT RAISE(ABORT, 'first copy only'); END;
    `)
    expect(await first.prepare("SELECT id FROM parents").first<string>("id")).toBe("changed")
    await expect(first.exec("INSERT INTO parents VALUES ('rejected')")).rejects.toThrow(
      "first copy only",
    )
    expect(await second.prepare("SELECT id FROM parents").first<string>("id")).toBe("seed")
    await second.exec("INSERT INTO parents VALUES ('second')")
  } finally {
    first.close()
    second.close()
  }

  const fresh = createDatabase()
  try {
    expect((await fresh.prepare("SELECT id FROM parents").all()).results).toEqual([{ id: "seed" }])
    await fresh.exec("INSERT INTO parents VALUES ('fresh')")
  } finally {
    fresh.close()
  }
})

test("schema 適用後の接続設定と外部キー・batch の全取消しを保つ", async () => {
  const database = createCompanyD1TestDatabaseTemplate(schemaSql)()

  try {
    expect(await database.prepare("PRAGMA foreign_keys").first<number>("foreign_keys")).toBe(1)
    expect(
      await database.prepare("PRAGMA legacy_alter_table").first<number>("legacy_alter_table"),
    ).toBe(0)
    expect(
      await database.prepare("PRAGMA recursive_triggers").first<number>("recursive_triggers"),
    ).toBe(1)
    await expect(
      database.batch([
        database.prepare("INSERT INTO parents VALUES ('rolled-back')"),
        database.prepare("INSERT INTO children VALUES ('invalid', 'missing')"),
      ]),
    ).rejects.toThrow("FOREIGN KEY constraint failed")
    expect((await database.prepare("SELECT id FROM parents").all()).results).toEqual([
      { id: "seed" },
    ])
    expect((await database.prepare("SELECT id FROM children").all()).results).toEqual([])
  } finally {
    database.close()
  }
})

test("schema が無効化した外部キーをコピーで有効化し直さない", async () => {
  const database = createCompanyD1TestDatabaseTemplate(`${schemaSql}\nPRAGMA foreign_keys = OFF;`)()

  try {
    expect(await database.prepare("PRAGMA foreign_keys").first<number>("foreign_keys")).toBe(0)
    await database.exec("INSERT INTO children VALUES ('allowed', 'missing')")
    expect(await database.prepare("SELECT id FROM children").first<string>("id")).toBe("allowed")
  } finally {
    database.close()
  }
})
