import { canAssignRoles } from "@/lib/iam/can-assign-roles"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
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

export type Granted = { reason: "granted" }

/**
 * アカウントにロールを付与する。iam:assign_roles 権限が必要。
 * 自分のアカウントへの自己付与は権限昇格経路になるため禁止する。
 * 付与する permission は付与者自身の permission の部分集合に限る(昇格防止)。
 * 付与後は対象アカウントの tokenVersion を増やして既存トークンを失効させる。
 */
export class GrantAccountRole {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Granted | ApplicationError> {
    if (canAssignRoles(command.session) === false) {
      return new ForbiddenError("cannot assign roles", "forbidden")
    }

    // 自分のアカウントに自分でロールを足す経路を塞ぐ(権限昇格防止)。
    if (command.accountId === command.session.accountId) {
      return new ForbiddenError("cannot assign roles to your own account", "self_assignment")
    }

    const roleRepository = new RoleRepository(this.c)

    const role = await roleRepository.findByKey(command.roleKey)

    if (role instanceof Error) {
      return new UnexpectedError("failed to find role", { cause: role })
    }

    if (role === null) {
      return new NotFoundError("role not found", "role_not_found")
    }

    // 付与するロールの permission が付与者の permission の部分集合かを確認(昇格防止)。
    const rolePermissions = await roleRepository.permissionKeysOf(role.id)

    if (rolePermissions instanceof Error) {
      return new UnexpectedError("failed to load role permissions", { cause: rolePermissions })
    }

    for (const key of rolePermissions) {
      if (command.session.permissions.has(key) === false) {
        return new ForbiddenError("cannot grant a permission you do not hold", "role_escalation")
      }
    }

    const accountRepository = new AccountRepository(this.c)

    const exists = await accountRepository.existsById(command.accountId)

    if (exists instanceof Error) {
      return new UnexpectedError("failed to find account", { cause: exists })
    }

    if (exists === false) {
      return new NotFoundError("account not found", "account_not_found")
    }

    const granted = await accountRepository.grantRoleAndBumpTokenVersion({
      accountId: command.accountId,
      roleId: role.id,
      grantedBy: command.session.accountId,
      now: command.now,
    })

    if (granted instanceof Error) {
      return new UnexpectedError("failed to grant role", { cause: granted })
    }

    return { reason: "granted" }
  }
}
