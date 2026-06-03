import { canManageEmployees } from "@/domain/employee/can-manage-employees"
import type { Context } from "@/env"
import { EmployeeRepository } from "@/infrastructure/employee/employee-repository"

export type Command = {
  viewerRole: string
  viewerEmployeeId: number
  code: string
}

export type Forbidden = { reason: "forbidden" }

export type EmployeeNotFound = { reason: "employee_not_found" }

export type SelfDelete = { reason: "self_delete" }

export type Deleted = { reason: "deleted" }

export type DeleteEmployeeFailure = Forbidden | EmployeeNotFound | SelfDelete

/**
 * 権限と存在を確認し、従業員を台帳から削除する。自分自身の削除は拒否する。
 */
export class DeleteEmployee {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Deleted | DeleteEmployeeFailure | Error> {
    const employeeRepository = new EmployeeRepository(this.c)

    if (canManageEmployees(command.viewerRole) === false) {
      return { reason: "forbidden" }
    }

    const employee = await employeeRepository.findByCode(command.code)

    if (employee instanceof Error) {
      return employee
    }

    if (employee === null) {
      return { reason: "employee_not_found" }
    }

    if (employee.id === command.viewerEmployeeId) {
      return { reason: "self_delete" }
    }

    const deleted = await employeeRepository.delete(command.code)

    if (deleted instanceof Error) {
      return deleted
    }

    return { reason: "deleted" }
  }
}
