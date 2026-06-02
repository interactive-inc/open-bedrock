import type { Employee } from "@/domain/employee/employee"
import type { Context } from "@/env"
import { EmployeeRepository } from "@/infrastructure/employee/employee-repository"

export type Command = {
  code: string
}

export type EmployeeNotFound = { reason: "employee_not_found" }

/**
 * 従業員を code 指定で1件取得する。台帳は認証済みの従業員に公開する。
 */
export class GetEmployee {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Employee | EmployeeNotFound | Error> {
    const employeeRepository = new EmployeeRepository(this.c)

    const employee = await employeeRepository.findByCode(command.code)

    if (employee instanceof Error) {
      return employee
    }

    if (employee === null) {
      return { reason: "employee_not_found" }
    }

    return employee
  }
}
