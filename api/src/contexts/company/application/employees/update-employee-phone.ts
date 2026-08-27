import { EmployeeEntity } from "@/contexts/company/domain/entities/employee.entity"
import {
  CompanyForbiddenError,
  CompanyNotFoundError,
  CompanyOperationError,
  CompanyUnexpectedError,
  CompanyValidationError,
} from "@/contexts/company/domain/errors"
import type { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import type { EmployeeRepository } from "@/contexts/company/infrastructure/repositories/employee/employee.repository"

type Context = Readonly<{ actor: CompanyActorValue; repository: EmployeeRepository; now: Date }>

export class UpdateEmployeePhone {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(phone: string | null): Promise<EmployeeEntity | CompanyOperationError> {
    if (this.c.actor.employeeId === null) return new CompanyForbiddenError()
    const current = await this.c.repository.findById(this.c.actor.employeeId)
    if (current instanceof Error) {
      return new CompanyUnexpectedError("failed to find Company employee", { cause: current })
    }
    if (current === null)
      return new CompanyNotFoundError("employee not found", "employee_not_found")
    const changed = current.withPhone(phone)
    if (changed instanceof Error) {
      return new CompanyValidationError("employee phone is invalid", "invalid_employee", {
        cause: changed,
      })
    }
    const updated = await this.c.repository.update(changed, this.c.now)
    if (updated instanceof Error) {
      return new CompanyUnexpectedError("failed to update Company employee", { cause: updated })
    }
    return updated ?? new CompanyNotFoundError("employee not found", "employee_not_found")
  }
}
