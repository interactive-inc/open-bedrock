import { OneOnOne } from "@/domain/oneonone/one-on-one.entity"
import type { Context } from "@/env"
import { IdentityRepository } from "@/infrastructure/auth/identity-repository"
import { EmployeeRepository } from "@/infrastructure/employee/employee-repository"
import { OneOnOneRepository } from "@/infrastructure/oneonone/one-on-one-repository"
import { UniqueConstraintError } from "@/infrastructure/shared/unique-constraint-error"
import { ConflictError, NotFoundError, UnexpectedError, ValidationError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  memberCode: string | null
  memberEmail: string | null
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
    const oneOnOneRepository = new OneOnOneRepository(this.c)

    let memberId: number | null | Error

    if (command.memberCode !== null) {
      const employee = await new EmployeeRepository(this.c).findByCode(command.memberCode)

      memberId = employee instanceof Error ? employee : (employee?.id ?? null)
    } else if (command.memberEmail !== null) {
      // 既存 CLI との互換用。新規クライアントは台帳の機微項目を取得せず code で指定する。
      memberId = await new IdentityRepository(this.c).findEmployeeIdByEmail(command.memberEmail)
    } else {
      memberId = null
    }

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
