import type { Employee } from "@/domain/employee/employee"
import { canManageEmployees } from "@/domain/employee/can-manage-employees"
import type { Context } from "@/env"
import { EmployeeRepository } from "@/infrastructure/employee/employee-repository"

export type Command = {
  viewerRole: string
  code: string
  profile: {
    name: string
    email: string
    role: string
    deptId: number | null
    deptName: string | null
    position: string | null
    status: "active" | "leave" | "retired"
  }
}

export type Forbidden = { reason: "forbidden" }

export type RoleEscalationForbidden = { reason: "role_escalation_forbidden" }

export type EmployeeNotFound = { reason: "employee_not_found" }

export type UpdateEmployeeFailure = Forbidden | RoleEscalationForbidden | EmployeeNotFound

/**
 * 権限と存在を確認し、従業員の氏名・メール・ロール・部署・役職・在籍状況を更新する。
 */
export class UpdateEmployee {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Employee | UpdateEmployeeFailure | Error> {
    const employeeRepository = new EmployeeRepository(this.c)

    if (canManageEmployees(command.viewerRole) === false) {
      return { reason: "forbidden" }
    }

    // admin 以外は employee ロールしか付与できない
    if (command.profile.role !== "employee" && command.viewerRole !== "admin") {
      return { reason: "role_escalation_forbidden" }
    }

    const employee = await employeeRepository.findByCode(command.code)

    if (employee instanceof Error) {
      return employee
    }

    if (employee === null) {
      return { reason: "employee_not_found" }
    }

    const updated = await employeeRepository.updateProfile(employee.withProfile(command.profile))

    if (updated instanceof Error) {
      return updated
    }

    if (updated === null) {
      return { reason: "employee_not_found" }
    }

    return updated
  }
}
