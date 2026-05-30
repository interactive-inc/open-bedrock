import { EmployeeSkill } from "@/domain/skill/employee-skill"
import type { Skill } from "@/domain/skill/skill"
import type { Context } from "@/env"
import { EmployeeSkillRepository } from "@/infrastructure/skill/employee-skill-repository"
import { SkillRepository } from "@/infrastructure/skill/skill-repository"

export type Command = {
  employeeId: number
  skillCode: string
  level: number
  years: number | null
  note: string | null
}

export type SkillNotFound = { reason: "skill_not_found" }

export type SetMySkillResult = {
  employeeSkill: EmployeeSkill
  skill: Skill
}

/**
 * 本人のスキルを登録・更新し、登録結果とスキルマスタを返す。
 */
export class SetMySkill {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<SetMySkillResult | SkillNotFound | Error> {
    const skillRepository = new SkillRepository(this.c)

    const employeeSkillRepository = new EmployeeSkillRepository(this.c)

    const skill = await skillRepository.findByCode(command.skillCode)

    if (skill instanceof Error) {
      return skill
    }

    if (skill === null) {
      return { reason: "skill_not_found" }
    }

    const employeeSkill = EmployeeSkill.create({
      employeeId: command.employeeId,
      skillCode: command.skillCode,
      level: command.level,
      years: command.years,
      note: command.note,
    })

    const saved = await employeeSkillRepository.save(employeeSkill)

    if (saved instanceof Error) {
      return saved
    }

    return { employeeSkill: saved, skill }
  }
}
