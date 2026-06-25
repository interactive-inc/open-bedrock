import { OneOnOne } from "@/domain/oneonone/one-on-one.entity"
import type { Context } from "@/env"
import { EmployeeRepository } from "@/infrastructure/employee/employee-repository"
import { OneOnOneRepository } from "@/infrastructure/oneonone/one-on-one-repository"
import { UniqueConstraintError } from "@/infrastructure/shared/unique-constraint-error"
import { ConflictError, NotFoundError, UnexpectedError, ValidationError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  memberEmail: string
  managerId: number
  heldAt: string
  topics: string | null
  managerNote: string | null
  nextAction: string | null
}

/**
 * マネージャーが対象社員との 1on1 を記録する。
 */
export class CreateOneOnOne {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<OneOnOne | ApplicationError> {
    const employeeRepository = new EmployeeRepository(this.c)

    const oneOnOneRepository = new OneOnOneRepository(this.c)

    const member = await employeeRepository.findByEmail(command.memberEmail)

    if (member instanceof Error) {
      return new UnexpectedError("failed to find member", { cause: member })
    }

    if (member === null) {
      return new NotFoundError("member not found", "member_not_found")
    }

    const oneOnOne = OneOnOne.create({
      memberId: member.id,
      managerId: command.managerId,
      heldAt: command.heldAt,
      topics: command.topics,
      managerNote: command.managerNote,
      nextAction: command.nextAction,
    })

    if ("reason" in oneOnOne) {
      return new ValidationError("member and manager must be different", "self_reference")
    }

    const saved = await oneOnOneRepository.save(oneOnOne)

    if (saved instanceof UniqueConstraintError) {
      return new ConflictError("one-on-one already exists", "duplicate")
    }

    if (saved instanceof Error) {
      return new UnexpectedError("failed to save one-on-one", { cause: saved })
    }

    return saved
  }
}
