import type { Employee } from "@/domain/employee/employee.entity"
import { canManageEmployees } from "@/lib/employee/can-manage-employees"
import type { Context, SessionPayload } from "@/env"
import { EmployeeRepository } from "@/infrastructure/employee/employee-repository"
import { LastAdminError } from "@/infrastructure/iam/last-admin-error"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  session: SessionPayload
  viewerEmployeeId: number
  code: string
  profile: {
    name: string
    deptId: number | null
    deptName: string | null
    position: string | null
    status: "active" | "leave" | "retired"
  }
}

/**
 * 権限と存在を確認し、従業員台帳の氏名・部署・役職・在籍状況を更新する。
 * email/role の認証・認可情報は IAM(identities/account_roles)が正で、ここでは扱わない。
 * ロール変更は GrantAccountRole / RevokeAccountRole 経由で行う。
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

    const nextEmployee = employee.withProfile(command.profile)
    const updated =
      employee.status !== "retired" && nextEmployee.status === "retired"
        ? await employeeRepository.updateProfileGuardingLastAdmin(nextEmployee)
        : await employeeRepository.updateProfile(nextEmployee)

    if (updated instanceof LastAdminError) {
      return new ConflictError("cannot retire the last admin", "last_admin")
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
