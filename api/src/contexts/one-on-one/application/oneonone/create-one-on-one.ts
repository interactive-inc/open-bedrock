import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { OneOnOne } from "@/contexts/one-on-one/domain/entities/one-on-one.entity"
import type { Context } from "@/env"
import { CompanyEmployeeDirectoryReadAdapter } from "@/contexts/company/infrastructure/adapters/employee/employee-directory-read.adapter"
import { OneOnOneRepository } from "@/contexts/one-on-one/infrastructure/repositories/oneonone/one-on-one.repository"
import { UniqueConstraintError } from "@/lib/d1/errors"
import { ConflictError, NotFoundError, UnexpectedError, ValidationError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  memberCode: string
  managerId: EmployeeId
  heldAt: string
  topics: string | null
  managerNote: string | null
  nextAction: string | null
}

/**
 * マネージャーが対象社員との 1on1 を記録する。
 */
export class CreateOneOnOne {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<OneOnOne | ApplicationError> {
    const oneOnOneRepository = new OneOnOneRepository(this.c)

    const employee = await new CompanyEmployeeDirectoryReadAdapter(this.c).findByCode(
      command.memberCode,
    )
    const memberId = employee instanceof Error ? employee : (employee?.id ?? null)

    if (memberId instanceof Error) {
      return new UnexpectedError("failed to find member", { cause: memberId })
    }

    if (memberId === null) {
      return new NotFoundError("member not found", "member_not_found")
    }

    const oneOnOne = OneOnOne.create({
      memberId: memberId,
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
