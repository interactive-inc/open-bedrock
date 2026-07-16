import { canAssignRoles } from "@/lib/iam/can-assign-roles"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context, SessionPayload } from "@/env"
import { AccountRepository } from "@/infrastructure/iam/account-repository"
import { LastAdminError } from "@/infrastructure/iam/last-admin-error"
import { LivePermissionGuardError } from "@/infrastructure/iam/live-permission-guard"
import { RoleRepository } from "@/infrastructure/iam/role-repository"
import { hasPermissionSuperset } from "@/lib/iam/has-permission-superset"

export type Command = {
  session: SessionPayload
  accountId: number
  roleKey: string
  now: number
}

export type Revoked = { reason: "revoked" }

/**
 * アカウントからロールを剥奪する。iam:assign_roles 権限が必要。
 * 最後の実効管理者を失うロール剥奪はできない(self-lockout 防止)。
 * 剥奪後は対象アカウントの tokenVersion を増やして既存トークンを失効させる。
 */
export class RevokeAccountRole {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Revoked | ApplicationError> {
    if (canAssignRoles(command.session) === false) {
      return new ForbiddenError("cannot assign roles", "forbidden")
    }

    const roleRepository = new RoleRepository(this.c)

    const role = await roleRepository.findByKey(command.roleKey)

    if (role instanceof Error) {
      return new UnexpectedError("failed to find role", { cause: role })
    }

    if (role === null) {
      return new NotFoundError("role not found", "role_not_found")
    }

    const rolePermissions = await roleRepository.permissionKeysOf(role.id)

    if (rolePermissions instanceof Error) {
      return new UnexpectedError("failed to load role permissions", { cause: rolePermissions })
    }

    if (hasPermissionSuperset(command.session, rolePermissions) === false) {
      return new ForbiddenError("cannot revoke a higher privilege role", "role_escalation")
    }

    const accountRepository = new AccountRepository(this.c)

    // ロール名にかかわらず、剥奪と実効管理者検査を同じ batch で確定する。
    const revoked = await accountRepository.revokeRoleGuardingLastAdmin(
      command.accountId,
      role.id,
      command.now,
      command.session.accountId,
    )

    if (revoked instanceof LastAdminError) {
      return new ConflictError("cannot remove the last effective admin", "last_admin")
    }

    if (revoked instanceof LivePermissionGuardError) {
      return new ForbiddenError("cannot revoke a higher privilege role", "role_escalation")
    }

    if (revoked instanceof Error) {
      return new UnexpectedError("failed to revoke role", { cause: revoked })
    }

    return { reason: "revoked" }
  }
}
