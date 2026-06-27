import { canManageRoles } from "@/lib/iam/can-manage-roles"
import { permissionKeySchema } from "@/lib/auth/permission-keys"
import { ForbiddenError, NotFoundError, UnexpectedError, ValidationError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context, SessionPayload } from "@/env"
import { RoleRepository } from "@/infrastructure/iam/role-repository"

export type Command = {
  session: SessionPayload
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
    if (canManageRoles(command.session) === false) {
      return new ForbiddenError("cannot manage roles", "forbidden")
    }

    for (const key of command.permissionKeys) {
      if (permissionKeySchema.safeParse(key).success === false) {
        return new ValidationError("unknown permission key", "unknown_permission")
      }

      if (command.session.permissions.has(key) === false) {
        return new ForbiddenError("cannot grant a permission you do not hold", "role_escalation")
      }
    }

    const roleRepository = new RoleRepository(this.c)

    const role = await roleRepository.findById(command.roleId)

    if (role instanceof Error) {
      return new UnexpectedError("failed to find role", { cause: role })
    }

    if (role === null) {
      return new NotFoundError("role not found", "role_not_found")
    }

    const metaUpdated = await roleRepository.updateMeta({
      roleId: command.roleId,
      name: command.name,
      description: command.description,
    })

    if (metaUpdated instanceof Error) {
      return new UnexpectedError("failed to update role", { cause: metaUpdated })
    }

    const replaced = await roleRepository.replacePermissions(command.roleId, command.permissionKeys)

    if (replaced instanceof Error) {
      return new UnexpectedError("failed to replace role permissions", { cause: replaced })
    }

    return { reason: "updated" }
  }
}
