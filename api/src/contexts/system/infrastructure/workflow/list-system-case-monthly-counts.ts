import type { SystemD1Context } from "@system/infrastructure/configuration/system-context"

export type SystemCaseMonthlyCount = Readonly<{ month: string; total: number }>

/** 指定日時以降のSystem Case作成件数をUTC月単位で返す。 */
export async function listSystemCaseMonthlyCounts(
  context: SystemD1Context,
  createdFrom: Date,
): Promise<ReadonlyArray<SystemCaseMonthlyCount> | Error> {
  if (!Number.isSafeInteger(createdFrom.getTime())) return new Error("invalid System Case range")
  try {
    const rows = await context.env.DB.prepare(
      `SELECT strftime('%Y-%m', created_at / 1000, 'unixepoch') AS month, count(*) AS total
       FROM system_cases
       WHERE created_at >= ?1
       GROUP BY strftime('%Y-%m', created_at / 1000, 'unixepoch')
       ORDER BY month`,
    )
      .bind(createdFrom.getTime())
      .all<SystemCaseMonthlyCount>()
    return rows.results
  } catch (caught) {
    return caught instanceof Error ? caught : new Error("failed to list System Case monthly counts")
  }
}
