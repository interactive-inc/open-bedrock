import type { Session } from "@/lib/auth/session"
import type { Employee } from "@/domain/employee/employee.entity"
import { resolveOrganizationAuthority } from "@/lib/org/resolve-organization-authority"
import type { Context } from "@/env"
import { EmployeeRepository } from "@/infrastructure/employee/employee-repository"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import { ApplicationError } from "@/lib/errors"

export type Command = {
  session: Session
  viewerEmployeeId: number
  code: string
  name: string
}

/**
 * 権限と組織スコープを確認し、人物台帳の氏名だけを更新する。
 * IAM、所属、役職、在籍状態は各専用操作が正で、この汎用更新では受け付けない。
 */
export class UpdateEmployee {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Employee | ApplicationError> {
    const employeeRepository = new EmployeeRepository(this.c)

    if (command.session.hasPermission("employee:update") === false) {
      return new ForbiddenError("cannot manage employees", "forbidden")
    }

    const employee = await employeeRepository.findByCode(command.code)

    if (employee instanceof Error) {
      return new UnexpectedError("failed to find employee", { cause: employee })
    }

    if (employee === null) {
      return new NotFoundError("employee not found", "employee_not_found")
    }

    const isSelf = employee.id === command.session.employeeId

    if (isSelf === false && command.session.hasPermission("org:manage") === false) {
      const authority = await resolveOrganizationAuthority(
        this.c,
        command.session.employeeId,
        employee.id,
      )

      if (authority instanceof Error) {
        return new UnexpectedError("failed to resolve organization authority", {
          cause: authority,
        })
      }

      if (authority.managementChain === false && authority.departmentManager === false) {
        return new ForbiddenError("cannot update employee outside organization scope", "forbidden")
      }
    }

    const updated = await employeeRepository.updateProfile(
      employee.withProfile({
        name: command.name,
        deptId: employee.deptId,
        deptName: employee.deptName,
        position: employee.position,
        status: employee.status,
      }),
    )

    if (updated instanceof Error) {
      return new UnexpectedError("failed to update employee", { cause: updated })
    }

    if (updated === null) {
      return new NotFoundError("employee not found", "employee_not_found")
    }

    return updated
  }
}
