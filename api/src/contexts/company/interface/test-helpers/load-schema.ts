import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

/** テスト用: migrations/ 配下の .sql を番号順に結合して 1 つのスキーマ文字列にする。 */
export function loadSchema(): string {
  const migrationsDir = join(import.meta.dir, "../../../../../migrations")

  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort()

  return files.map((file) => readFileSync(join(migrationsDir, file), "utf8")).join("\n")
}
