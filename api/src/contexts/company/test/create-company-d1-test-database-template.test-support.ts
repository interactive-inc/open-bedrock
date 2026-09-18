import { Database } from "bun:sqlite"
import { createCompanyD1TestDatabase } from "@/contexts/company/test/d1-test-database.test-support"

/** schema の適用結果だけを共有し、呼び出しごとに書き込み可能な独立 DB を返す。 */
export function createCompanyD1TestDatabaseTemplate(schemaSql: string) {
  const source = new Database(":memory:")

  try {
    source.exec("PRAGMA foreign_keys = ON")
    source.exec(schemaSql)

    // 接続設定は serialize に含まれないため、schema 適用直後の値をコピーにも戻す。
    const pragmas = ["foreign_keys", "legacy_alter_table", "recursive_triggers"].map((name) => {
      const value = source.query<Record<string, number>, []>(`PRAGMA ${name}`).get()?.[name]
      if (value === undefined) throw new Error(`missing pragma: ${name}`)
      return `PRAGMA ${name} = ${value};`
    })
    const serialized = source.serialize()

    return () => {
      const copy = Database.deserialize(serialized)
      copy.exec(pragmas.join("\n"))
      return Object.assign(createCompanyD1TestDatabase(copy), { close: () => copy.close() })
    }
  } finally {
    source.close()
  }
}
