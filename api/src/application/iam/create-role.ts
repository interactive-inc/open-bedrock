import { canManageRoles } from "@/lib/iam/can-manage-roles"
import { permissionKeySchema } from "@/lib/auth/permission-keys"
import { ConflictError, ForbiddenError, UnexpectedError, ValidationError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context, SessionPayload } from "@/env"
import type { RoleRow } from "@/schema"
import { RoleRepository } from "@/infrastructure/iam/role-repository"

export type Command = {
  session: SessionPayload
  key: string
  name: string
  description: string | null
  permissionKeys: ReadonlyArray<string>
  now: number
}

/**
 * 動的ロールを作成する。iam:manage_roles 権限が必要。
 * 付与する permission は作成者自身が持つ permission の部分集合に限る(権限昇格の防止)。
 */
export class CreateRole {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<RoleRow | ApplicationError> {
    if (canManageRoles(command.session) === false) {
      return new ForbiddenError("cannot manage roles", "forbidden")
    }

    for (const key of command.permissionKeys) {
      if (permissionKeySchema.safeParse(key).success === false) {
        return new ValidationError("unknown permission key", "unknown_permission")
      }

      // 権限昇格防止: 自分が持たない permission を含むロールは作れない。
      if (command.session.permissions.has(key) === false) {
        return new ForbiddenError("cannot grant a permission you do not hold", "role_escalation")
      }
    }

    const roleRepository = new RoleRepository(this.c)

    const created = await roleRepository.createWithPermissions({
      key: command.key,
      name: command.name,
      description: command.description,
      createdAt: command.now,
      permissionKeys: command.permissionKeys,
    })

    if (created === "role_key_conflict") {
      return new ConflictError("role key already exists", "role_key_conflict")
    }

    if (created instanceof Error) {
      return new UnexpectedError("failed to create role", { cause: created })
    }

    return created
  }
}
