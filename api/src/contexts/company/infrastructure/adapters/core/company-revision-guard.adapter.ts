import { sql } from "drizzle-orm"
import type { BatchItem } from "drizzle-orm/batch"
import { drizzle } from "drizzle-orm/d1"

/** SELECT が必ず一行を返し、組織不在も含む版不一致で batch を中断する。 */
export function prepareCompanyOrganizationRevisionGuardStatement(
  input: Readonly<{
    database: D1Database
    organizationId: string
    expectedRevision: number
  }>,
): BatchItem<"sqlite"> {
  return drizzle(input.database)
    .select({
      revisionGuard: sql<number>`json_extract(
      CASE WHEN
        (SELECT revision FROM company_organizations WHERE id = ${input.organizationId})
          = ${input.expectedRevision}
        THEN '{"revision":0}' ELSE 'company_revision_conflict'
      END, '$.revision')`,
    })
    .from(sql`(SELECT 1) AS company_revision_guard`)
}
