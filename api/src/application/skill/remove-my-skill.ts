import type { Context } from "@/env"
import { EmployeeSkillRepository } from "@/infrastructure/skill/employee-skill-repository"

export type Command = {
  employeeId: number
  skillCode: string
}

export type SkillNotRegistered = { reason: "skill_not_registered" }

export type Removed = { reason: "removed" }

/**
 * 本人の登録スキルを1件削除する。未登録のスキルコードは削除対象なしとして返す。
 */
export class RemoveMySkill {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Removed | SkillNotRegistered | Error> {
    const employeeSkillRepository = new EmployeeSkillRepository(this.c)

    const current = await employeeSkillRepository.findByEmployeeAndCode({
      employeeId: command.employeeId,
      skillCode: command.skillCode,
    })

    if (current instanceof Error) {
      return current
    }

    if (current === null) {
      return { reason: "skill_not_registered" }
    }

    const deleted = await employeeSkillRepository.delete({
      employeeId: command.employeeId,
      skillCode: command.skillCode,
    })

    if (deleted instanceof Error) {
      return deleted
    }

    if (deleted === null) {
      return { reason: "skill_not_registered" }
    }

    return { reason: "removed" }
  }
}
