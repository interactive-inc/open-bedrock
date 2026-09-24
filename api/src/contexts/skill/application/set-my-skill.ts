import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { EmployeeSkill } from "@/contexts/skill/domain/entities/employee-skill.entity"
import type { Skill } from "@/contexts/skill/domain/entities/skill.entity"
import { ConflictError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { EmployeeSkillRepository } from "@/contexts/skill/infrastructure/repositories/employee-skill.repository"
import type { SkillRepository } from "@/contexts/skill/infrastructure/repositories/skill.repository"
import { isSkillRecordSourceFrozenError } from "@/contexts/skill/infrastructure/repositories/lib/is-skill-record-source-frozen-error"

export type Command = {
  employeeId: EmployeeId
  skillCode: string
  level: number
  years: number | null
  note: string | null
}

type Context = Readonly<{
  skillRepository: Pick<SkillRepository, "findByCode">
  employeeSkillRepository: Pick<EmployeeSkillRepository, "save">
}>

export type SetMySkillResult = {
  employeeSkill: EmployeeSkill
  skill: Skill
}

/**
 * 本人のスキルを登録・更新し、登録結果とスキルマスタを返す。
 */
export class SetMySkill {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<SetMySkillResult | ApplicationError> {
    const skill = await this.c.skillRepository.findByCode(command.skillCode)

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

    const saved = await this.c.employeeSkillRepository.save(employeeSkill)

    if (saved instanceof Error) {
      if (isSkillRecordSourceFrozenError(saved))
        return new ConflictError("skill writes are frozen", "record_source_frozen", {
          cause: saved,
        })
      return new UnexpectedError("failed to save skill", { cause: saved })
    }

    return { employeeSkill: saved, skill }
  }
}
