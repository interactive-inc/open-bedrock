import { OneOnOne } from "@/domain/oneonone/one-on-one"
import type { Context } from "@/env"
import { EmployeeRepository } from "@/infrastructure/employee/employee-repository"
import { OneOnOneRepository } from "@/infrastructure/oneonone/one-on-one-repository"

export type Command = {
  memberEmail: string
  managerId: number
  heldAt: string
  topics: string | null
  managerNote: string | null
  nextAction: string | null
}

export type MemberNotFound = { reason: "member_not_found" }

/**
 * マネージャーが対象社員との 1on1 を記録する。
 */
export class CreateOneOnOne {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<OneOnOne | MemberNotFound | Error> {
    const employeeRepository = new EmployeeRepository(this.c)

    const oneOnOneRepository = new OneOnOneRepository(this.c)

    const member = await employeeRepository.findByEmail(command.memberEmail)

    if (member instanceof Error) {
      return member
    }

    if (member === null) {
      return { reason: "member_not_found" }
    }

    const oneOnOne = OneOnOne.create({
      memberId: member.id,
      managerId: command.managerId,
      heldAt: command.heldAt,
      topics: command.topics,
      managerNote: command.managerNote,
      nextAction: command.nextAction,
    })

    return await oneOnOneRepository.save(oneOnOne)
  }
}
