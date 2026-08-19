import { wrapSystemD1TestDatabase } from "@system/infrastructure/auth/wrap-system-d1-test-database.test-support"
import { Database } from "bun:sqlite"

type Options = Readonly<{ onQuery?: () => void }>

/** Bun SQLiteをportable System infrastructure test向けのD1境界へ適応する。 */
export function createSystemD1TestDatabase(schema: string, options?: Options): D1Database {
  const sqlite = new Database(":memory:")

  sqlite.exec(schema)

  return wrapSystemD1TestDatabase(sqlite, options)
}
