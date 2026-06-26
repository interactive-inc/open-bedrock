import type { EmployeeSkill } from "@/domain/skill/employee-skill.entity"
import type { Skill } from "@/domain/skill/skill.entity"
import type { Context } from "@/env"
import { NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { EmployeeSkillRepository } from "@/infrastructure/skill/employee-skill-repository"
import { SkillRepository } from "@/infrastructure/skill/skill-repository"

export type Command = {
  employeeId: number
  skillCode: string
}

export type GetMySkillResult = {
  employeeSkill: EmployeeSkill
  skill: Skill | null
}

/**
 * 本人の登録スキルを1件取得し、スキルマスタを結合して返す。
 */
export class GetMySkill {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<GetMySkillResult | ApplicationError> {
    const employeeSkillRepository = new EmployeeSkillRepository(this.c)

    const employeeSkill = await employeeSkillRepository.findByEmployeeAndCode({
      employeeId: command.employeeId,
      skillCode: command.skillCode,
    })

    if (employeeSkill instanceof Error) {
      return new UnexpectedError("failed to find skill", { cause: employeeSkill })
    }

    if (employeeSkill === null) {
      return new NotFoundError("skill not registered", "skill_not_registered")
    }

    const skill = await new SkillRepository(this.c).findByCode(command.skillCode)

    if (skill instanceof Error) {
      return new UnexpectedError("failed to find skill", { cause: skill })
    }

    return { employeeSkill, skill }
  }
}
