import { toPasswordHash } from "@/domain/auth/to-password-hash"
import type { Employee } from "@/domain/employee/employee"
import { canManageEmployees } from "@/domain/employee/can-manage-employees"
import type { Context } from "@/env"
import { EmployeeRepository } from "@/infrastructure/employee/employee-repository"
import { UniqueConstraintError } from "@/infrastructure/shared/unique-constraint-error"

export type Command = {
  viewerRole: string
  employee: {
    code: string
    name: string
    email: string
    password: string
    role: string
    deptId: number | null
    deptName: string | null
    position: string | null
    status: "active" | "leave" | "retired"
  }
}

export type Forbidden = { reason: "forbidden" }

export type RoleEscalationForbidden = { reason: "role_escalation_forbidden" }

export type CodeConflict = { reason: "employee_code_conflict" }

export type EmailConflict = { reason: "email_conflict" }

export type WeakPassword = { reason: "weak_password" }

// パスワード最低文字数。route 層の zod 検証と二重で防御する。
const MIN_PASSWORD_LENGTH = 8

/**
 * 権限と重複コードを確認し、新しい従業員を台帳に登録する。
 */
export class RegisterEmployee {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<
    Employee | Forbidden | RoleEscalationForbidden | CodeConflict | EmailConflict | WeakPassword | Error
  > {
    const employeeRepository = new EmployeeRepository(this.c)

    if (canManageEmployees(command.viewerRole) === false) {
      return { reason: "forbidden" }
    }

    // admin 以外は member ロールしか付与できない
    if (command.employee.role !== "member" && command.viewerRole !== "admin") {
      return { reason: "role_escalation_forbidden" }
    }

    if (command.employee.password.length < MIN_PASSWORD_LENGTH) {
      return { reason: "weak_password" }
    }

    const existing = await employeeRepository.findByCode(command.employee.code)

    if (existing instanceof Error) {
      return existing
    }

    if (existing !== null) {
      return { reason: "employee_code_conflict" }
    }

    return this.persist(command)
  }

  private async persist(command: Command): Promise<Employee | EmailConflict | Error> {
    const employeeRepository = new EmployeeRepository(this.c)

    const passwordHash = await toPasswordHash(command.employee.password)

    const result = await employeeRepository.create({
      code: command.employee.code,
      name: command.employee.name,
      email: command.employee.email,
      passwordHash: passwordHash,
      role: command.employee.role,
      deptId: command.employee.deptId,
      deptName: command.employee.deptName,
      position: command.employee.position,
      status: command.employee.status,
    })

    // code の重複は事前チェック済みなので、ここで UniqueConstraintError が出るのは email の重複。
    if (result instanceof UniqueConstraintError) {
      return { reason: "email_conflict" }
    }

    return result
  }
}
