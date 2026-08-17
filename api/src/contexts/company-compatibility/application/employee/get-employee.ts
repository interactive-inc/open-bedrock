import type { Employee } from "@/contexts/company-compatibility/domain/employee/employee.entity"
import type { Context } from "@/env"
import { EmployeeRepository } from "@/contexts/company-compatibility/infrastructure/employee/employee-repository"
import { NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  code: string
}

/**
 * 従業員を code 指定で1件取得する。台帳は認証済みの従業員に公開する。
 */
export class GetEmployee {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Employee | ApplicationError> {
    const employeeRepository = new EmployeeRepository(this.c)

    const employee = await employeeRepository.findByCode(command.code)

    if (employee instanceof Error) {
      return new UnexpectedError("failed to find employee", { cause: employee })
    }

    if (employee === null) {
      return new NotFoundError("employee not found", "employee_not_found")
    }

    return employee
  }
}
