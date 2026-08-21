import { trainingCourses } from "@/contexts/training/infrastructure/schema/training"
import type { Context } from "@/env"

/** Governance compositionが参照するTraining course codeを一括取得する。 */
export async function readTrainingCourseCodeSet(context: Context): Promise<ReadonlySet<string>> {
  const rows = await context.var.database
    .select({ code: trainingCourses.code })
    .from(trainingCourses)

  return new Set(rows.map((row) => row.code))
}
