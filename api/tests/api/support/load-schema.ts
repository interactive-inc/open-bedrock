import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

let cachedSchema: string | null = null

/**
 * テスト用: migrations/ 配下の .sql を番号順に結合して 1 つのスキーマ文字列にする。
 * migration は 1 回の読み込みで 20ms 近くかかりテストごとに呼ばれるため、プロセス内で 1 回だけ読む。
 */
export function loadSchema(): string {
  if (cachedSchema !== null) {
    return cachedSchema
  }

  const migrationsDir = join(import.meta.dir, "../../../migrations")

  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort()

  cachedSchema = files.map((file) => readFileSync(join(migrationsDir, file), "utf8")).join("\n")

  return cachedSchema
}
