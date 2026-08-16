import { EmployeeSkill } from "@/contexts/skill/domain/employee-skill.entity"
import type { Skill } from "@/contexts/skill/domain/skill.entity"
import type { Context } from "@/env"
import { NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { EmployeeSkillRepository } from "@/contexts/skill/infrastructure/employee-skill-repository"
import { SkillRepository } from "@/contexts/skill/infrastructure/skill-repository"

export type Command = {
  employeeId: number
  skillCode: string
  level: number
  years: number | null
  note: string | null
}

export type SetMySkillResult = {
  employeeSkill: EmployeeSkill
  skill: Skill
}

/**
 * 本人のスキルを登録・更新し、登録結果とスキルマスタを返す。
 */
export class SetMySkill {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<SetMySkillResult | ApplicationError> {
    const skillRepository = new SkillRepository(this.c)

    const employeeSkillRepository = new EmployeeSkillRepository(this.c)

    const skill = await skillRepository.findByCode(command.skillCode)

    if (skill instanceof Error) {
      return new UnexpectedError("failed to find skill", { cause: skill })
    }

    if (skill === null) {
      return new NotFoundError("skill not found", "skill_not_found")
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
      return new UnexpectedError("failed to save skill", { cause: saved })
    }

    return { employeeSkill: saved, skill }
  }
}
