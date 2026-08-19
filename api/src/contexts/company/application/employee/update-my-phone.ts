import type { Session } from "@/contexts/company/domain/iam/session"
import type { Employee } from "@/contexts/company/domain/employee/employee.entity"
import type { Context } from "@/env"
import { EmployeeRepository } from "@/contexts/company/infrastructure/employee/employee-repository"
import { NotFoundError, UnexpectedError, ValidationError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  session: Session
  phone: string | null
}

/**
 * 本人が自己申告する電話番号を更新する。常に session の本人だけを対象にする。
 */
export class UpdateMyPhone {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Employee | ApplicationError> {
    if (command.phone !== null && command.phone.length > 30) {
      return new ValidationError("phone must be 30 characters or fewer", "invalid_phone")
    }

    const employeeRepository = new EmployeeRepository(this.c)

    const updated = await employeeRepository.updatePhone(command.session.employeeId, command.phone)

    if (updated instanceof Error) {
      return new UnexpectedError("failed to update phone", { cause: updated })
    }

    if (updated === null) {
      return new NotFoundError("employee not found", "employee_not_found")
    }

    return updated
  }
}
