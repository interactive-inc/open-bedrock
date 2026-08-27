import type { Session } from "@/lib/auth/session"
import type { EmployeeDirectoryEntryValue } from "@/contexts/company/domain/values/employee-directory-entry.value"
import type { Context } from "@/env"
import { EmployeeRepository } from "@/contexts/company/infrastructure/employee/employee.repository"
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
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<EmployeeDirectoryEntryValue | ApplicationError> {
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
