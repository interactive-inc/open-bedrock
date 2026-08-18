import type { Session } from "@/contexts/company-compatibility/domain/iam/session"
import { permissionKeySchema } from "@/contexts/company-compatibility/domain/iam/permission-key.catalog"
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnexpectedError,
  ValidationError,
} from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { RoleRepository } from "@/contexts/company-compatibility/infrastructure/iam/role-repository"
import { LastRootError } from "@/contexts/company-compatibility/infrastructure/iam/last-root-error"
import { LivePermissionGuardError } from "@/contexts/company-compatibility/infrastructure/iam/live-permission-guard-error"
import { hasSystemPermissionSuperset } from "@system/domain/iam/has-system-permission-superset"

export type Command = {
  session: Session
  roleId: number
  name: string
  description: string | null
  permissionKeys: ReadonlyArray<string>
  now: number
}

export type Updated = { reason: "updated" }

/**
 * ロールの名前・説明・権限を更新する。iam:manage_roles 権限が必要。
 * system role は key/種別は変えられないが name/description/permission は編集できる。
 * 付与する permission は編集者自身が持つ permission の部分集合に限る(権限昇格の防止)。
 */
export class UpdateRole {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Updated | ApplicationError> {
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

    const currentPermissionKeys = await roleRepository.permissionKeysOf(command.roleId)

    if (currentPermissionKeys instanceof Error) {
      return new UnexpectedError("failed to load role permissions", {
        cause: currentPermissionKeys,
      })
    }

    // 現在のロールが実行者より高権限なら、権限の除去も含めて変更を拒否する。
    if (hasSystemPermissionSuperset(command.session, currentPermissionKeys) === false) {
      return new ForbiddenError("cannot edit a higher privilege role", "role_escalation")
    }

    for (const key of command.permissionKeys) {
      if (permissionKeySchema.safeParse(key).success === false) {
        return new ValidationError("unknown permission key", "unknown_permission")
      }

      if (command.session.permissions.has(key) === false) {
        return new ForbiddenError("cannot grant a permission you do not hold", "role_escalation")
      }
    }

    const updated = await roleRepository.updateMetaAndPermissions({
      actorAccountId: command.session.accountId,
      roleId: command.roleId,
      name: command.name,
      description: command.description,
      permissionKeys: command.permissionKeys,
    })

    if (updated instanceof LastRootError) {
      return new ConflictError("cannot remove the last effective admin", "last_admin")
    }

    if (updated instanceof LivePermissionGuardError) {
      return new ForbiddenError("cannot edit a higher privilege role", "role_escalation")
    }

    if (updated instanceof Error) {
      return new UnexpectedError("failed to update role", { cause: updated })
    }

    return { reason: "updated" }
  }
}
