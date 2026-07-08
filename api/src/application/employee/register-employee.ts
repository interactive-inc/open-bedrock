import { toPasswordHash } from "@/lib/auth/to-password-hash"
import { hasPermission } from "@/lib/auth/has-permission"
import { Employee } from "@/domain/employee/employee.entity"
import { canManageEmployees } from "@/lib/employee/can-manage-employees"
import type { Context, SessionPayload } from "@/env"
import { EmployeeRepository } from "@/infrastructure/employee/employee-repository"
import { IdentityRepository } from "@/infrastructure/auth/identity-repository"
import { AccountProvisioner } from "@/infrastructure/iam/account-provisioner"
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

    // employee:assign_role 権限がなければ member 以外のロールを付与できない
    if (command.employee.role !== "member" && !hasPermission(command.session, "employee:assign_role")) {
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

  /**
   * employee / account / identity / account_role を単一の D1 batch でアトミックに作成する。
   * email 重複は batch 外で事前チェックし、batch 内では UNIQUE 制約でも二重防御する。
   * 途中失敗時は batch 全体が rollback され、孤立レコード（employee だけ・account だけ）を防ぐ。
   */
  private async persist(command: Command): Promise<Employee | ApplicationError> {
    const passwordHash = await toPasswordHash(command.employee.password)

    // email(認証情報)の重複は identities が正。batch の前に確認する。
    const existingByEmail = await new IdentityRepository(this.c).findEmployeeIdByEmail(
      command.employee.email,
    )

    if (existingByEmail instanceof Error) {
      return new UnexpectedError("failed to check email", { cause: existingByEmail })
    }

    if (existingByEmail !== null) {
      return new ConflictError("email already exists", "email_conflict")
    }

    const provisioner = new AccountProvisioner(this.c)

    const result = await provisioner.provisionWithEmployee({
      employee: {
        code: command.employee.code,
        name: command.employee.name,
        deptId: command.employee.deptId,
        deptName: command.employee.deptName,
        position: command.employee.position,
        status: command.employee.status,
      },
      email: command.employee.email,
      passwordHash: passwordHash,
      roleKey: command.employee.role,
      now: Number(this.c.env.NOW === undefined ? Date.now() : Date.parse(this.c.env.NOW)),
    })

    if (result instanceof Error) {
      if (result.message.includes("UNIQUE constraint")) {
        return new ConflictError("employee code already exists", "employee_code_conflict")
      }

      return new UnexpectedError("failed to register employee", { cause: result })
    }

    return new Employee({
      id: result,
      code: command.employee.code,
      name: command.employee.name,
      deptId: command.employee.deptId,
      deptName: command.employee.deptName,
      position: command.employee.position,
      status: command.employee.status,
    })
  }
}
