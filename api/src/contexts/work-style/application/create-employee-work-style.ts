import type { Session } from "@/contexts/company/domain/iam/session"
import { EmployeeWorkStyle } from "@/contexts/work-style/domain/employee-work-style.entity"
import { ForbiddenError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { WorkStyle } from "@/lib/schemas"
import type { Context } from "@/env"
import { EmployeeWorkStyleRepository } from "@/contexts/work-style/infrastructure/employee-work-style-repository"

export type Command = {
  session: Session
  employeeId: number
  style: WorkStyle
  startsOn: string
  endsOn: string | null
  note: string | null
  createdAt: string
}

/**
 * 権限を確認し、従業員の勤務形態を 1 件記録する。
 */
export class CreateEmployeeWorkStyle {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<EmployeeWorkStyle | ApplicationError> {
    if (command.session.hasPermission("work_style:manage") === false) {
      return new ForbiddenError("cannot manage work styles", "forbidden")
    }

    const repository = new EmployeeWorkStyleRepository(this.c)

    const workStyle = EmployeeWorkStyle.create({
      employeeId: command.employeeId,
      style: command.style,
      startsOn: command.startsOn,
      endsOn: command.endsOn,
      note: command.note,
      createdAt: command.createdAt,
    })

    const created = await repository.create(workStyle)

    if (created instanceof Error) {
      return new UnexpectedError("failed to create work style", { cause: created })
    }

    return created
  }
}
