import type { Session } from "@/contexts/company/domain/iam/session"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { RoleRepository } from "@/contexts/company/infrastructure/iam/role-repository"
import { hasSystemPermissionSuperset } from "@system/domain/iam/has-system-permission-superset"

export type Command = {
  session: Session
  roleId: number
}

export type Deleted = { reason: "deleted" }

/**
 * 動的ロールを削除する。iam:manage_roles 権限が必要。
 * system role は削除不可。アカウントに割当中のロールも削除不可。
 */
export class DeleteRole {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Deleted | ApplicationError> {
    if (command.session.hasPermission("iam:manage_roles") === false) {
      return new ForbiddenError("cannot manage roles", "forbidden")
    }

    const roleRepository = new RoleRepository(this.c)

    const role = await roleRepository.findById(command.roleId)

    if (role instanceof Error) {
      return new UnexpectedError("failed to find role", { cause: role })
    }

    if (role === null) {
      return new NotFoundError("role not found", "role_not_found")
    }

    const permissionKeys = await roleRepository.permissionKeysOf(command.roleId)

    if (permissionKeys instanceof Error) {
      return new UnexpectedError("failed to load role permissions", { cause: permissionKeys })
    }

    if (hasSystemPermissionSuperset(command.session, permissionKeys) === false) {
      return new ForbiddenError("cannot delete a higher privilege role", "role_escalation")
    }

    if (role.isSystem === 1) {
      return new ConflictError("cannot delete a system role", "system_role")
    }

    const deleted = await roleRepository.deleteWithPermissionsGuardingAssignment(command.roleId)

    if (deleted === "role_in_use") {
      return new ConflictError("role is assigned to accounts", "role_in_use")
    }

    if (deleted instanceof Error) {
      return new UnexpectedError("failed to delete role", { cause: deleted })
    }

    return { reason: "deleted" }
  }
}
