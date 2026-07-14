import type { Employee } from "@/domain/employee/employee.entity"
import { canUpdateEmployee } from "@/lib/employee/can-update-employee"
import { hasPermission } from "@/lib/auth/has-permission"
import { resolveOrganizationAuthority } from "@/lib/org/organization-authority"
import type { Context, SessionPayload } from "@/env"
import { EmployeeRepository } from "@/infrastructure/employee/employee-repository"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import { ApplicationError } from "@/lib/errors"
import { EmployeeLifecycleRepository } from "@/infrastructure/employee-lifecycle/employee-lifecycle-repository"
import { GetLifecycleState } from "@/application/employee-lifecycle/get-lifecycle-state"

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

    if (canUpdateEmployee(command.session) === false) {
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

    if (isSelf === false && hasPermission(command.session, "org:manage") === false) {
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

    const migrationStatus = await new EmployeeLifecycleRepository(this.c).migrationStatus()
    if (migrationStatus instanceof ApplicationError) return migrationStatus
    const state =
      migrationStatus === "verified"
        ? await new GetLifecycleState(this.c).run({ employeeId: employee.id })
        : undefined
    if (state instanceof ApplicationError) return state
    const currentProfile = {
      deptId: employee.deptId,
      deptName: state?.primaryAssignment?.departmentName ?? employee.deptName,
      position: state?.primaryAssignment?.positionTitle ?? employee.position,
      status: state?.status === "prehire" ? employee.status : (state?.status ?? employee.status),
    }
    if (
      command.profile.deptId !== currentProfile.deptId ||
      command.profile.deptName !== currentProfile.deptName ||
      command.profile.position !== currentProfile.position ||
      command.profile.status !== currentProfile.status
    ) {
      return new ConflictError(
        "department, position, and status must be changed with a personnel action",
        "lifecycle_action_required",
      )
    }

    const updated = await employeeRepository.updateProfile(
      employee.withProfile({ name: command.profile.name, ...currentProfile }),
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
