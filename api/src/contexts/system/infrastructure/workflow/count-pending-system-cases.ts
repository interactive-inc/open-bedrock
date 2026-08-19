import type { SystemD1Context } from "@system/infrastructure/configuration/system-context"

/** 未完了System Caseの件数だけを公開し、保存形式を下位contextへ漏らさない。 */
export async function countPendingSystemCases(context: SystemD1Context): Promise<number | Error> {
  try {
    return (
      (await context.env.DB.prepare(
        "SELECT count(*) AS total FROM system_cases WHERE status = 'pending'",
      ).first<number>("total")) ?? 0
    )
  } catch (caught) {
    return caught instanceof Error ? caught : new Error("failed to count pending System Cases")
  }
}
