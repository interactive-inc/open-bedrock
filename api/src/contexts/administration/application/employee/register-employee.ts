import type { Session } from "@/lib/auth/session"
import { ApplyPersonnelAction } from "@/contexts/company/application/employee-lifecycle/apply-personnel-action"
import type { EmployeeDirectoryEntryValue } from "@/contexts/company/domain/values/employee-directory-entry.value"
import type { Context } from "@/env"
import { IdentityAdapter } from "@/contexts/administration/infrastructure/adapters/auth/identity.adapter"
import { EmployeeRepository } from "@/contexts/company/infrastructure/employee/employee.repository"
import { PrepareEmployeeAccountProvisioningAdapter } from "@/contexts/administration/infrastructure/adapters/iam/prepare-employee-account-provisioning.adapter"
import { RegisterEmployeeAdapter } from "@/contexts/administration/infrastructure/adapters/employee/register-employee.adapter"
import { SystemPasswordValue } from "@system/domain/values/auth/system-password.value"
import { hashPassword } from "@system/infrastructure/auth/hash-password.repository"
import { CompanyOperationError } from "@/contexts/company/domain/errors"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import {
  ApplicationError,
  ConflictError,
  ForbiddenError,
  UnexpectedError,
  ValidationError,
} from "@/lib/errors"

export type Command = {
  session: Session
  employee: {
    code: string
    name: string
    hireOn: string
    email: string
    password: string
    role: string
    departmentCode: string | null
    positionTitle: string | null
    managerEmployeeCode: string | null
  }
}

export class RegisterEmployee {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<EmployeeDirectoryEntryValue | ApplicationError> {
    if (
      !command.session.hasPermission("employee:create") ||
      !command.session.hasPermission("employee:lifecycle:apply") ||
      !command.session.hasPermission("account:manage")
    ) {
      return new ForbiddenError(
        "direct hire requires employee, lifecycle, and account permissions",
        "forbidden",
      )
    }
    if (
      command.employee.role !== "member" &&
      !command.session.hasPermission("employee:assign_role")
    ) {
      return new ForbiddenError(
        "only authorized account managers can assign non-member roles",
        "role_escalation_forbidden",
      )
    }
    const adapter = new RegisterEmployeeAdapter(this.c)
    const role = await adapter.findRole(`company:${command.employee.role}`)
    if (role instanceof Error) {
      return new UnexpectedError("failed to find role", { cause: role })
    }
    if (role === null) return new ValidationError("role not found", "role_not_found")
    if (
      !role.permissionKeys.every((permissionKey) => command.session.hasPermission(permissionKey))
    ) {
      return new ForbiddenError(
        "cannot assign a role with permissions you do not hold",
        "role_escalation_forbidden",
      )
    }
    const password = SystemPasswordValue.create(command.employee.password)
    if (password instanceof Error) {
      return new ValidationError("password must be between 12 and 200 characters", password.reason)
    }
    const pepper = this.c.env.PEPPER_SECRET
    if (pepper === undefined || pepper === "") {
      return new UnexpectedError("employee registration is unavailable")
    }
    const [existing, existingByEmail] = await Promise.all([
      new EmployeeRepository(this.c).findByCode(command.employee.code),
      new IdentityAdapter(this.c).findEmployeeIdByEmail(command.employee.email),
    ])
    if (existing instanceof Error || existingByEmail instanceof Error) {
      return new UnexpectedError("failed to validate employee identity", {
        cause: existing instanceof Error ? existing : existingByEmail,
      })
    }
    if (existing !== null) {
      return new ConflictError("employee code already exists", "employee_code_conflict")
    }
    if (existingByEmail !== null) {
      return new ConflictError("email already exists", "email_conflict")
    }

    const organizationRevision = await adapter.organizationRevision()
    if (organizationRevision instanceof Error) {
      return new UnexpectedError("failed to read organization revision", {
        cause: organizationRevision,
      })
    }
    const prepared = await new ApplyPersonnelAction(this.c).prepareDirectProspectiveHire({
      session: command.session,
      input: {
        kind: "hire",
        employeeCode: command.employee.code,
        employeeName: command.employee.name,
        eventOn: restoreCalendarDate(command.employee.hireOn),
        departmentCode: command.employee.departmentCode,
        positionTitle: command.employee.positionTitle,
        managerEmployeeCode: command.employee.managerEmployeeCode,
      },
      idempotencyKey: `employee-register:${crypto.randomUUID()}`,
      expectedOrganizationRevision: organizationRevision,
    })
    if (prepared instanceof CompanyOperationError) {
      return new UnexpectedError("入社処理を準備できません", {
        cause: prepared,
      })
    }

    const passwordHash = await hashPassword(password.toString(), pepper)
    const now = new Date(this.c.env.NOW ?? Date.now())
    const accountStatements = new PrepareEmployeeAccountProvisioningAdapter(this.c).prepare({
      employeeCode: command.employee.code,
      email: command.employee.email,
      passwordHash,
      roleId: role.id,
      actorAccountId: command.session.accountId,
      now,
    })
    if (accountStatements instanceof Error) {
      return new UnexpectedError("failed to prepare employee Account", {
        cause: accountStatements,
      })
    }
    const committed = await adapter.commit([...prepared.statements, ...accountStatements])
    if (committed === "forbidden") {
      return new ForbiddenError(
        "live permissions changed while registering employee",
        "role_escalation_forbidden",
      )
    }
    if (committed === "conflict") {
      return new ConflictError("employee identity already exists", "employee_code_conflict")
    }
    if (committed instanceof Error) {
      return new UnexpectedError("failed to register employee", { cause: committed })
    }
    const created = await new EmployeeRepository(this.c).findByCode(command.employee.code)
    return created instanceof Error || created === null
      ? new UnexpectedError("failed to read registered employee", {
          cause: created instanceof Error ? created : undefined,
        })
      : created
  }
}
