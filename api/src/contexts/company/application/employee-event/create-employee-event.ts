import type { Session } from "@/contexts/company/domain/iam/session"
import { EmployeeEvent } from "@/contexts/company/domain/employee-event/employee-event.entity"
import { ForbiddenError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { EmployeeEventRepository } from "@/contexts/company/infrastructure/employee-event/employee-event.repository"

export type Command = {
  session: Session
  employeeId: number
  kind: "join" | "transfer" | "leave_of_absence" | "return" | "retire"
  effectiveDate: string
  fromDepartmentCode: string | null
  toDepartmentCode: string | null
  note: string | null
  createdAt: string
}

/**
 * 権限を確認し、社員の異動・在籍イベントを1件記録する。
 */
export class CreateEmployeeEvent {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<EmployeeEvent | ApplicationError> {
    if (command.session.hasPermission("employee_event:manage") === false) {
      return new ForbiddenError("cannot manage employee events", "forbidden")
    }

    const repository = new EmployeeEventRepository(this.c)

    const employeeEvent = EmployeeEvent.create({
      employeeId: command.employeeId,
      kind: command.kind,
      effectiveDate: command.effectiveDate,
      fromDepartmentCode: command.fromDepartmentCode,
      toDepartmentCode: command.toDepartmentCode,
      note: command.note,
      createdAt: command.createdAt,
    })

    const created = await repository.create(employeeEvent)

    if (created instanceof Error) {
      return new UnexpectedError("failed to create employee event", { cause: created })
    }

    return created
  }
}
