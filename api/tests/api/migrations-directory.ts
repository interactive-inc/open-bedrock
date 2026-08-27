import { existsSync } from "node:fs"
import { resolve } from "node:path"

/** 配置変更に影響されない、Bun DBテスト用migration正本ディレクトリ。 */
const projectRoot = resolve(import.meta.dir, "../..")
export const TEST_MIGRATIONS_DIR = existsSync(resolve(projectRoot, "migrations"))
  ? resolve(projectRoot, "migrations")
  : resolve(projectRoot, "drizzle")
