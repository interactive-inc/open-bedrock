import type { Session } from "@/contexts/company/domain/iam/session"
import { ForbiddenError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { RoleRepository, type RoleRow } from "@/contexts/company/infrastructure/iam/role-repository"

export type ListedRole = {
  role: RoleRow
  permissionKeys: ReadonlyArray<string>
}

export type Command = {
  session: Session
}

/**
 * ロール一覧を返す。ロール管理者に加え、割当候補の参照が必要なロール割当者も利用できる。
 */
export class ListRoles {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<ReadonlyArray<ListedRole> | ApplicationError> {
    if (
      command.session.hasPermission("iam:manage_roles") === false &&
      command.session.hasPermission("iam:assign_roles") === false
    ) {
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
