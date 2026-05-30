import { EmployeeSkill } from "@/domain/skill/employee-skill"
import type { Context } from "@/env"
import { employeeSkills } from "@/schema"

export class EmployeeSkillRepository {
  constructor(private readonly c: Context) {}

  // 業務キー（employeeId×skillCode）で upsert する。
  async save(employeeSkill: EmployeeSkill): Promise<EmployeeSkill | Error> {
    try {
      const rows = await this.c.var.database
        .insert(employeeSkills)
        .values({
          employeeId: employeeSkill.employeeId,
          skillCode: employeeSkill.skillCode,
          level: employeeSkill.level,
          years: employeeSkill.years,
          note: employeeSkill.note,
        })
        .onConflictDoUpdate({
          target: [employeeSkills.employeeId, employeeSkills.skillCode],
          set: {
            level: employeeSkill.level,
            years: employeeSkill.years,
            note: employeeSkill.note,
          },
        })
        .returning()

      const row = rows.at(0)

      if (row === undefined) {
        return new Error("employee_skills upsert returned no row")
      }

      return EmployeeSkill.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to upsert employee_skill")
    }
  }
}
