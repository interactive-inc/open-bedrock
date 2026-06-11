import type { Employee } from "@/domain/employee/employee"
import { canManageEmployees } from "@/domain/employee/can-manage-employees"
import type { Context } from "@/env"
import { EmployeeRepository } from "@/infrastructure/employee/employee-repository"

export type Command = {
  viewerRole: string
  viewerEmployeeId: number
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

export type CannotDemoteSelf = { reason: "cannot_demote_self" }

export type EmailConflict = { reason: "email_conflict" }

export type LastAdmin = { reason: "last_admin" }

export type UpdateEmployeeFailure =
  | Forbidden
  | RoleEscalationForbidden
  | EmployeeNotFound
  | CannotDemoteSelf
  | EmailConflict
  | LastAdmin

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

    const employee = await employeeRepository.findByCode(command.code)

    if (employee instanceof Error) {
      return employee
    }

    if (employee === null) {
      return { reason: "employee_not_found" }
    }

    // 自分自身の admin ロールを外すことはできない
    if (
      employee.id === command.viewerEmployeeId &&
      employee.role === "admin" &&
      command.profile.role !== "admin"
    ) {
      return { reason: "cannot_demote_self" }
    }

    // 最後の admin を降格させることはできない
    if (employee.role === "admin" && command.profile.role !== "admin") {
      const adminCount = await employeeRepository.countByRole("admin")

      if (adminCount instanceof Error) {
        return adminCount
      }

      if (adminCount <= 1) {
        return { reason: "last_admin" }
      }
    }

    // ロール変更は admin のみ許可
    if (command.profile.role !== employee.role && command.viewerRole !== "admin") {
      return { reason: "role_escalation_forbidden" }
    }

    // メール変更時は重複チェック
    if (command.profile.email.toLowerCase() !== employee.email.toLowerCase()) {
      const existingByEmail = await employeeRepository.findByEmail(command.profile.email)

      if (existingByEmail instanceof Error) {
        return existingByEmail
      }

      if (existingByEmail !== null && existingByEmail.id !== employee.id) {
        return { reason: "email_conflict" }
      }
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
