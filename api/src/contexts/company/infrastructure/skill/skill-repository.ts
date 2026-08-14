import { Skill } from "@/domain/skill/skill.entity"
import type { Context } from "@/env"
import { skills } from "@/schema"
import { eq } from "drizzle-orm"

export class SkillRepository {
  constructor(private readonly c: Context) {}

  async findByCode(code: string): Promise<Skill | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(skills)
        .where(eq(skills.code, code))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : Skill.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load skill")
    }
  }
}
