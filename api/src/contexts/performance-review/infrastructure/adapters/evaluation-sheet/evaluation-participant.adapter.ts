import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { readCompanyEmployeeProfiles } from "@/contexts/company/interface/operations/read-company-employee-profiles"
import { evaluationTemplates } from "@/contexts/performance-review/infrastructure/schema/performance-review"
import type { Context } from "@/env"
import { eq } from "drizzle-orm"

export class EvaluationParticipantAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async existingEmployeeIds(
    employeeIds: ReadonlyArray<EmployeeId>,
  ): Promise<Set<EmployeeId> | Error> {
    try {
      if (employeeIds.length === 0) return new Set<EmployeeId>()
      // 実在する従業員だけを、Company の従業員ごとの正本で確かめる。
      const profiles = await readCompanyEmployeeProfiles({
        database: this.c.env.DB,
        employeeIds,
        now: this.c.env.NOW,
        timeZone: this.c.env.COMPANY_TIME_ZONE,
      })
      if (profiles instanceof Error) return profiles
      return new Set(profiles.keys())
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load evaluation participants")
    }
  }

  async evaluationTemplateExists(templateId: number): Promise<boolean | Error> {
    try {
      const rows = await this.c.var.database
        .select({ id: evaluationTemplates.id })
        .from(evaluationTemplates)
        .where(eq(evaluationTemplates.id, templateId))
        .limit(1)
      return rows.length > 0
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load evaluation template")
    }
  }
}
