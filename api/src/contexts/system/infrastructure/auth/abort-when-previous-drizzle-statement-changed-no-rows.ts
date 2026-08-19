import type { SystemDatabase } from "@system/infrastructure/configuration/system-context"
import { sql } from "drizzle-orm"

/** 直前のDrizzle mutationが0行ならD1 batchをrollbackさせるguard query。 */
export function abortWhenPreviousDrizzleStatementChangedNoRows(database: SystemDatabase) {
  return database
    .select({
      ok: sql<number>`CASE WHEN changes() = 0 THEN json_extract('', '$') ELSE 1 END`,
    })
    .from(sql`(SELECT 1)`)
}
