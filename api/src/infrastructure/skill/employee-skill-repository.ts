import { EmployeeSkill } from "@/domain/skill/employee-skill"
import type { Context } from "@/env"
import { employeeSkills } from "@/schema"
import { and, eq } from "drizzle-orm"

type EmployeeSkillKey = {
  employeeId: number
  skillCode: string
}

export class EmployeeSkillRepository {
  constructor(private readonly c: Context) {}

  // 業務キー（employeeId×skillCode）で1件取得する。存在しなければ null。
  async findByEmployeeAndCode(key: EmployeeSkillKey): Promise<EmployeeSkill | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(employeeSkills)
        .where(
          and(
            eq(employeeSkills.employeeId, key.employeeId),
            eq(employeeSkills.skillCode, key.skillCode),
          ),
        )

      const row = rows.at(0)

      return row === undefined ? null : EmployeeSkill.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load employee_skill")
    }
  }

  // 業務キー（employeeId×skillCode）で1件削除する。
  async delete(key: EmployeeSkillKey): Promise<null | Error> {
    try {
      await this.c.var.database
        .delete(employeeSkills)
        .where(
          and(
            eq(employeeSkills.employeeId, key.employeeId),
            eq(employeeSkills.skillCode, key.skillCode),
          ),
        )

      return null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete employee_skill")
    }
  }

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
