import { canManageRoles } from "@/lib/iam/can-manage-roles"
import { ForbiddenError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context, SessionPayload } from "@/env"
import type { RoleRow } from "@/schema"
import { RoleRepository } from "@/infrastructure/iam/role-repository"

export type Command = {
  session: SessionPayload
}

/**
 * ロール一覧を返す。iam:manage_roles 権限が必要。
 */
export class ListRoles {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<ReadonlyArray<RoleRow> | ApplicationError> {
    if (canManageRoles(command.session) === false) {
      return new ForbiddenError("cannot manage roles", "forbidden")
    }

    const roleRepository = new RoleRepository(this.c)

    const found = await roleRepository.list()

    if (found instanceof Error) {
      return new UnexpectedError("failed to list roles", { cause: found })
    }

    return found
  }
}
