import { Database } from "bun:sqlite"

/** D1 adapter と明示的なテンプレートで schema の保存・復元規則を共有する。 */
export function createCompanySqliteTestDatabaseTemplate(schemaSql: string) {
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

    return {
      serialized: source.serialize(),
      pragmas,
      createDatabase() {
        const copy = Database.deserialize(this.serialized)
        try {
          copy.exec(this.pragmas.join("\n"))
          return copy
        } catch (error) {
          copy.close()
          throw error
        }
      },
    }
  } finally {
    source.close()
  }
}
