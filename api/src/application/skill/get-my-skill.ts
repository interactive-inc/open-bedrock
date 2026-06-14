import type { EmployeeSkill } from "@/domain/skill/employee-skill.entity"
import type { Skill } from "@/domain/skill/skill.entity"
import type { Context } from "@/env"
import { EmployeeSkillRepository } from "@/infrastructure/skill/employee-skill-repository"
import { SkillRepository } from "@/infrastructure/skill/skill-repository"

export type Command = {
  employeeId: number
  skillCode: string
}

export type SkillNotRegistered = { reason: "skill_not_registered" }

export type GetMySkillResult = {
  employeeSkill: EmployeeSkill
  skill: Skill | null
}

/**
 * 本人の登録スキルを1件取得し、スキルマスタを結合して返す。
 */
export class GetMySkill {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<GetMySkillResult | SkillNotRegistered | Error> {
    const employeeSkillRepository = new EmployeeSkillRepository(this.c)

    const employeeSkill = await employeeSkillRepository.findByEmployeeAndCode({
      employeeId: command.employeeId,
      skillCode: command.skillCode,
    })

    if (employeeSkill instanceof Error) {
      return employeeSkill
    }

    if (employeeSkill === null) {
      return { reason: "skill_not_registered" }
    }

    const skill = await new SkillRepository(this.c).findByCode(command.skillCode)

    if (skill instanceof Error) {
      return skill
    }

    return { employeeSkill, skill }
  }
}
