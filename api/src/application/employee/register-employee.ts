import { toPasswordHash } from "@/lib/auth/to-password-hash"
import type { Employee } from "@/domain/employee/employee.entity"
import { canManageEmployees } from "@/lib/employee/can-manage-employees"
import type { Context, SessionPayload } from "@/env"
import { EmployeeRepository } from "@/infrastructure/employee/employee-repository"
import { UniqueConstraintError } from "@/infrastructure/shared/unique-constraint-error"
import { ConflictError, ForbiddenError, UnexpectedError, ValidationError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  session: SessionPayload
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

// パスワード最低文字数。route 層の zod 検証と二重で防御する。
const MIN_PASSWORD_LENGTH = 8

/**
 * 権限と重複コードを確認し、新しい従業員を台帳に登録する。
 */
export class RegisterEmployee {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Employee | ApplicationError> {
    const employeeRepository = new EmployeeRepository(this.c)

    if (canManageEmployees(command.session) === false) {
      return new ForbiddenError("cannot manage employees", "forbidden")
    }

    // admin 以外は member ロールしか付与できない
    if (command.employee.role !== "member" && command.session.role !== "admin") {
      return new ForbiddenError(
        "only admin can assign non-member roles",
        "role_escalation_forbidden",
      )
    }

    if (command.employee.password.length < MIN_PASSWORD_LENGTH) {
      return new ValidationError("password is too weak", "weak_password")
    }

    const existing = await employeeRepository.findByCode(command.employee.code)

    if (existing instanceof Error) {
      return new UnexpectedError("failed to find employee", { cause: existing })
    }

    if (existing !== null) {
      return new ConflictError("employee code already exists", "employee_code_conflict")
    }

    return this.persist(command)
  }

  private async persist(command: Command): Promise<Employee | ApplicationError> {
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

    if (result instanceof UniqueConstraintError) {
      const causeMsg = result.cause instanceof Error ? result.cause.message : ""

      if (/employees\.code/i.test(causeMsg)) {
        return new ConflictError("employee code already exists", "employee_code_conflict")
      }

      return new ConflictError("email already exists", "email_conflict")
    }

    if (result instanceof Error) {
      return new UnexpectedError("failed to create employee", { cause: result })
    }

    return result
  }
}
