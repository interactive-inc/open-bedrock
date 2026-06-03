import { toPasswordHash } from "@/domain/auth/to-password-hash"
import type { Employee } from "@/domain/employee/employee"
import { canManageEmployees } from "@/domain/employee/can-manage-employees"
import type { Context } from "@/env"
import { EmployeeRepository } from "@/infrastructure/employee/employee-repository"

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

export type CodeConflict = { reason: "employee_code_conflict" }

/**
 * 権限と重複コードを確認し、新しい従業員を台帳に登録する。
 */
export class RegisterEmployee {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Employee | Forbidden | CodeConflict | Error> {
    const employeeRepository = new EmployeeRepository(this.c)

    if (canManageEmployees(command.viewerRole) === false) {
      return { reason: "forbidden" }
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

  private async persist(command: Command): Promise<Employee | Error> {
    const employeeRepository = new EmployeeRepository(this.c)

    const passwordHash = await toPasswordHash(command.employee.password)

    return employeeRepository.create({
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
  }
}
