import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { employees } from "@/contexts/company/infrastructure/schema/employee"
import { evaluationTemplates } from "@/contexts/performance-review/infrastructure/schema/performance-review"
import type { Context } from "@/env"
import { eq, inArray } from "drizzle-orm"

export class EvaluationParticipantAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async existingEmployeeIds(
    employeeIds: ReadonlyArray<EmployeeId>,
  ): Promise<Set<EmployeeId> | Error> {
    try {
      if (employeeIds.length === 0) return new Set<EmployeeId>()
      const rows = await this.c.var.database
        .select({ id: employees.id })
        .from(employees)
        .where(inArray(employees.id, employeeIds))
      return new Set(rows.map((row) => row.id))
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
