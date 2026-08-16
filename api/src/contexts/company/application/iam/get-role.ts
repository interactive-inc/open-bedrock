import type { Session } from "@/contexts/company/domain/iam/session"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import type { RoleRow } from "@/api/legacy-system/adapters/schema/system"
import { RoleRepository } from "@/contexts/company/infrastructure/iam/role-repository"

export type RoleDetail = {
  role: RoleRow
  permissionKeys: ReadonlyArray<string>
}

export type Command = {
  session: Session
  roleId: number
}

/**
 * ロール詳細を割当済み permission キー付きで返す。iam:manage_roles 権限が必要。
 */
export class GetRole {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<RoleDetail | ApplicationError> {
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

    return { role: role, permissionKeys: permissionKeys }
  }
}
