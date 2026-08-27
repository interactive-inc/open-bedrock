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

export class UpdateEmployeeName {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(input: {
    code: string
    officialName: string
  }): Promise<EmployeeEntity | CompanyOperationError> {
    if (!this.c.actor.hasPermission("employee:write:basic")) return new CompanyForbiddenError()
    const current = await this.c.repository.findByCode(input.code)
    if (current instanceof Error) {
      return new CompanyUnexpectedError("failed to find Company employee", { cause: current })
    }
    if (current === null)
      return new CompanyNotFoundError("employee not found", "employee_not_found")
    const changed = current.withOfficialName(input.officialName)
    if (changed instanceof Error) {
      return new CompanyValidationError("employee name is invalid", "invalid_employee", {
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
