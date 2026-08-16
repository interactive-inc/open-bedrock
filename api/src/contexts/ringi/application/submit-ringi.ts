import { RingiRequest } from "@/contexts/ringi/domain/ringi-request.entity"
import type { Context } from "@/env"
import { EmployeeRepository } from "@/contexts/company/infrastructure/employee/employee-repository"
import { RingiRequestRepository } from "@/contexts/ringi/infrastructure/ringi-request-repository"
import { UnexpectedError, ValidationError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  applicantId: number
  approverId: number
  title: string
  amount: number
  reason: string
  createdAt: string
}

/**
 * 稟議を起案する。承認者は起案時に 1 名指定し、実在の従業員か確認する。
 * 自分自身を承認者に指定することはできない。
 */
export class SubmitRingi {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<RingiRequest | ApplicationError> {
    if (command.approverId === command.applicantId) {
      return new ValidationError("cannot assign yourself as approver", "invalid_approver")
    }

    const employeeRepository = new EmployeeRepository(this.c)

    const approver = await employeeRepository.findById(command.approverId)

    if (approver instanceof Error) {
      return new UnexpectedError("failed to find approver", { cause: approver })
    }

    if (approver === null) {
      return new ValidationError("approver not found", "invalid_approver")
    }

    const ringi = RingiRequest.create({
      applicantId: command.applicantId,
      approverId: command.approverId,
      title: command.title,
      amount: command.amount,
      reason: command.reason,
      createdAt: command.createdAt,
    })

    const repository = new RingiRequestRepository(this.c)

    const created = await repository.create(ringi)

    if (created instanceof Error) {
      return new UnexpectedError("failed to create ringi request", { cause: created })
    }

    return created
  }
}
