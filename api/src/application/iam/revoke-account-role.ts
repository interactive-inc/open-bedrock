import { canAssignRoles } from "@/lib/iam/can-assign-roles"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context, SessionPayload } from "@/env"
import { AccountRepository } from "@/infrastructure/iam/account-repository"
import { RoleRepository } from "@/infrastructure/iam/role-repository"

export type Command = {
  session: SessionPayload
  accountId: number
  roleKey: string
  now: number
}

export type Revoked = { reason: "revoked" }

/**
 * アカウントからロールを剥奪する。iam:assign_roles 権限が必要。
 * 最後の system admin を降格させることはできない(self-lockout 防止)。
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

    const accountRepository = new AccountRepository(this.c)

    // 最後の system admin を外すと誰も管理できなくなるため禁止する。
    if (role.key === "admin" && role.isSystem === 1) {
      const adminCount = await accountRepository.countAccountsWithSystemRole("admin")

      if (adminCount instanceof Error) {
        return new UnexpectedError("failed to count admins", { cause: adminCount })
      }

      if (adminCount <= 1) {
        return new ConflictError("cannot remove the last admin", "last_admin")
      }
    }

    const revoked = await accountRepository.revokeRole(command.accountId, role.id)

    if (revoked instanceof Error) {
      return new UnexpectedError("failed to revoke role", { cause: revoked })
    }

    const bumped = await accountRepository.bumpTokenVersion(command.accountId, command.now)

    if (bumped instanceof Error) {
      return new UnexpectedError("failed to revoke sessions", { cause: bumped })
    }

    return { reason: "revoked" }
  }
}
