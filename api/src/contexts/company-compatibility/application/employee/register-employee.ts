import type { Session } from "@/contexts/company-compatibility/domain/iam/session"
import { ApplyPersonnelAction } from "@/contexts/company-compatibility/application/employee-lifecycle/apply-personnel-action"
import type { Employee } from "@/contexts/company-compatibility/domain/employee/employee.entity"
import type { Context } from "@/env"
import { IdentityRepository } from "@/contexts/company-compatibility/infrastructure/auth/identity-repository"
import { EmployeeRepository } from "@/contexts/company-compatibility/infrastructure/employee/employee-repository"
import { AccountProvisioner } from "@/contexts/company-compatibility/infrastructure/iam/account-provisioner"
import { LivePermissionGuard } from "@/contexts/company-compatibility/infrastructure/iam/live-permission-guard"
import { RoleRepository } from "@/contexts/company-compatibility/infrastructure/iam/role-repository"
import { validatePasswordComplexity } from "@/api/legacy-system/use-cases/auth/password-policy"
import { toPasswordHash } from "@/lib/auth/to-password-hash"
import { isAbortedByGuard } from "@/lib/database/is-aborted-by-guard"
import {
  ApplicationError,
  ConflictError,
  ForbiddenError,
  UnexpectedError,
  ValidationError,
} from "@/lib/errors"
import { hasPermissionSuperset } from "@/api/legacy-system/use-cases/iam/has-permission-superset"

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
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Employee | ApplicationError> {
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
    const roleRepository = new RoleRepository(this.c)
    const role = await roleRepository.findByKey(command.employee.role)
    if (role instanceof Error) {
      return new UnexpectedError("failed to find role", { cause: role })
    }
    if (role === null) return new ValidationError("role not found", "role_not_found")
    const rolePermissions = await roleRepository.permissionKeysOf(role.id)
    if (rolePermissions instanceof Error) {
      return new UnexpectedError("failed to load role permissions", { cause: rolePermissions })
    }
    if (!hasPermissionSuperset(command.session, rolePermissions)) {
      return new ForbiddenError(
        "cannot assign a role with permissions you do not hold",
        "role_escalation_forbidden",
      )
    }
    const passwordError = validatePasswordComplexity(command.employee.password)
    if (passwordError !== null) return passwordError
    const [existing, existingByEmail] = await Promise.all([
      new EmployeeRepository(this.c).findByCode(command.employee.code),
      new IdentityRepository(this.c).findEmployeeIdByEmail(command.employee.email),
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

    const organizationRevision =
      (await this.c.env.DB.prepare(
        "SELECT revision FROM organization_lifecycle_states WHERE id = 1",
      ).first<number>("revision")) ?? 0
    const prepared = await new ApplyPersonnelAction(this.c).prepareDirectProspectiveHire({
      session: command.session,
      input: {
        kind: "hire",
        employeeCode: command.employee.code,
        employeeName: command.employee.name,
        eventOn: command.employee.hireOn,
        departmentCode: command.employee.departmentCode,
        positionTitle: command.employee.positionTitle,
        managerEmployeeCode: command.employee.managerEmployeeCode,
      },
      idempotencyKey: `employee-register:${crypto.randomUUID()}`,
      expectedOrganizationRevision: organizationRevision,
    })
    if (prepared instanceof ApplicationError) return prepared

    const passwordHash = await toPasswordHash(command.employee.password)
    const now = Number(this.c.env.NOW === undefined ? Date.now() : Date.parse(this.c.env.NOW))
    const accountStatements = new AccountProvisioner(this.c).prepareProvisionByEmployeeCode({
      employeeCode: command.employee.code,
      email: command.employee.email,
      passwordHash,
      roleKey: command.employee.role,
      grantedByAccountId: command.session.accountId,
      now,
    })
    try {
      await this.c.env.DB.batch([...prepared.statements, ...accountStatements])
    } catch (cause) {
      if (LivePermissionGuard.isAbortedBy(cause) || isAbortedByGuard(cause)) {
        return new ForbiddenError(
          "live permissions changed while registering employee",
          "role_escalation_forbidden",
        )
      }
      if (cause instanceof Error && cause.message.includes("UNIQUE constraint")) {
        return new ConflictError("employee identity already exists", "employee_code_conflict")
      }
      return new UnexpectedError("failed to register employee", { cause })
    }
    const created = await new EmployeeRepository(this.c).findByCode(command.employee.code)
    return created instanceof Error || created === null
      ? new UnexpectedError("failed to read registered employee", {
          cause: created instanceof Error ? created : undefined,
        })
      : created
  }
}
