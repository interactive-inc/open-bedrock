import type { Context } from "@/env"
import { NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { EmployeeSkillRepository } from "@/contexts/company/infrastructure/skill/employee-skill-repository"

export type Command = {
  employeeId: number
  skillCode: string
}

export type Removed = { reason: "removed" }

/**
 * 本人の登録スキルを1件削除する。未登録のスキルコードは削除対象なしとして返す。
 */
export class RemoveMySkill {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Removed | ApplicationError> {
    const employeeSkillRepository = new EmployeeSkillRepository(this.c)

    const current = await employeeSkillRepository.findByEmployeeAndCode({
      employeeId: command.employeeId,
      skillCode: command.skillCode,
    })

    if (current instanceof Error) {
      return new UnexpectedError("failed to find skill", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("skill not registered", "skill_not_registered")
    }

    const deleted = await employeeSkillRepository.delete({
      employeeId: command.employeeId,
      skillCode: command.skillCode,
    })

    if (deleted instanceof Error) {
      return new UnexpectedError("failed to delete skill", { cause: deleted })
    }

    if (deleted === null) {
      return new NotFoundError("skill not registered", "skill_not_registered")
    }

    return { reason: "removed" }
  }
}
