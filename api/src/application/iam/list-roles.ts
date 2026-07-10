import { canManageRoles } from "@/lib/iam/can-manage-roles"
import { canAssignRoles } from "@/lib/iam/can-assign-roles"
import { ForbiddenError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context, SessionPayload } from "@/env"
import type { RoleRow } from "@/schema"
import { RoleRepository } from "@/infrastructure/iam/role-repository"

export type ListedRole = {
  role: RoleRow
  permissionKeys: ReadonlyArray<string>
}

export type Command = {
  session: SessionPayload
}

/**
 * ロール一覧を返す。ロール管理者に加え、割当候補の参照が必要なロール割当者も利用できる。
 */
export class ListRoles {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<ReadonlyArray<ListedRole> | ApplicationError> {
    if (canManageRoles(command.session) === false && canAssignRoles(command.session) === false) {
      return new ForbiddenError("cannot manage roles", "forbidden")
    }

    const roleRepository = new RoleRepository(this.c)

    const found = await roleRepository.list()

    if (found instanceof Error) {
      return new UnexpectedError("failed to list roles", { cause: found })
    }

    const withPermissions = await Promise.all(
      found.map(async (role) => ({
        role: role,
        permissionKeys: await roleRepository.permissionKeysOf(role.id),
      })),
    )

    const failed = withPermissions.find(
      (entry): entry is { role: RoleRow; permissionKeys: Error } =>
        entry.permissionKeys instanceof Error,
    )

    if (failed !== undefined) {
      return new UnexpectedError("failed to load role permissions", {
        cause: failed.permissionKeys,
      })
    }

    return withPermissions as ReadonlyArray<ListedRole>
  }
}
