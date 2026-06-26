import type { Employee } from "@/domain/employee/employee.entity"
import { canManageEmployees } from "@/lib/employee/can-manage-employees"
import type { Context, SessionPayload } from "@/env"
import { EmployeeRepository } from "@/infrastructure/employee/employee-repository"
import { UniqueConstraintError } from "@/infrastructure/shared/unique-constraint-error"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  session: SessionPayload
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

/**
 * 権限と存在を確認し、従業員の氏名・メール・ロール・部署・役職・在籍状況を更新する。
 */
export class UpdateEmployee {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Employee | ApplicationError> {
    const employeeRepository = new EmployeeRepository(this.c)

    if (canManageEmployees(command.session) === false) {
      return new ForbiddenError("cannot manage employees", "forbidden")
    }

    const employee = await employeeRepository.findByCode(command.code)

    if (employee instanceof Error) {
      return new UnexpectedError("failed to find employee", { cause: employee })
    }

    if (employee === null) {
      return new NotFoundError("employee not found", "employee_not_found")
    }

    // 自分自身の admin ロールを外すことはできない
    if (
      employee.id === command.viewerEmployeeId &&
      employee.role === "admin" &&
      command.profile.role !== "admin"
    ) {
      return new ForbiddenError("cannot remove admin role from yourself", "cannot_demote_self")
    }

    // 最後の admin を降格させることはできない
    if (employee.role === "admin" && command.profile.role !== "admin") {
      const adminCount = await employeeRepository.countByRole("admin")

      if (adminCount instanceof Error) {
        return new UnexpectedError("failed to count admins", { cause: adminCount })
      }

      if (adminCount <= 1) {
        return new ConflictError("cannot remove the last admin", "last_admin")
      }
    }

    // ロール変更は admin のみ許可
    if (command.profile.role !== employee.role && command.session.role !== "admin") {
      return new ForbiddenError(
        "only admin can assign non-member roles",
        "role_escalation_forbidden",
      )
    }

    // メール変更時は重複チェック
    if (command.profile.email.toLowerCase() !== employee.email.toLowerCase()) {
      const existingByEmail = await employeeRepository.findByEmail(command.profile.email)

      if (existingByEmail instanceof Error) {
        return new UnexpectedError("failed to find employee", { cause: existingByEmail })
      }

      if (existingByEmail !== null && existingByEmail.id !== employee.id) {
        return new ConflictError("email already exists", "email_conflict")
      }
    }

    const updated = await employeeRepository.updateProfile(employee.withProfile(command.profile))

    if (updated instanceof UniqueConstraintError) {
      return new ConflictError("email already exists", "email_conflict")
    }

    if (updated instanceof Error) {
      return new UnexpectedError("failed to update employee", { cause: updated })
    }

    if (updated === null) {
      return new NotFoundError("employee not found", "employee_not_found")
    }

    return updated
  }
}
