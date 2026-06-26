import type { Context } from "@/env"
import { accountRoles, permissions, rolePermissions, roles } from "@/schema"
import type { RoleRow } from "@/schema"
import { isUniqueConstraintError } from "@/infrastructure/shared/is-unique-constraint-error"
import { UniqueConstraintError } from "@/infrastructure/shared/unique-constraint-error"
import { eq, inArray } from "drizzle-orm"

// IAM のロールと、その permission 割当を扱う。動的ロールの CRUD と permission 一括置換を担う。

export type RoleWithPermissions = {
  role: RoleRow
  permissionKeys: ReadonlyArray<string>
}

/**
 * roles と role_permissions を扱うリポジトリ。
 */
export class RoleRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async list(): Promise<ReadonlyArray<RoleRow> | Error> {
    try {
      return await this.c.var.database.select().from(roles)
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to list roles")
    }
  }

  async findById(id: number): Promise<RoleRow | null | Error> {
    try {
      const rows = await this.c.var.database.select().from(roles).where(eq(roles.id, id)).limit(1)

      return rows.at(0) ?? null
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to find role")
    }
  }

  async findByKey(key: string): Promise<RoleRow | null | Error> {
    try {
      const rows = await this.c.var.database.select().from(roles).where(eq(roles.key, key)).limit(1)

      return rows.at(0) ?? null
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to find role")
    }
  }

  async create(props: {
    key: string
    name: string
    description: string | null
    createdAt: number
  }): Promise<RoleRow | Error> {
    try {
      const rows = await this.c.var.database
        .insert(roles)
        .values({
          key: props.key,
          name: props.name,
          description: props.description,
          isSystem: 0,
          createdAt: props.createdAt,
        })
        .returning()

      const created = rows.at(0)

      return created ?? new Error("failed to create role")
    } catch (caught) {
      if (isUniqueConstraintError(caught)) {
        return new UniqueConstraintError("role key already exists", { cause: caught })
      }

      return caught instanceof Error ? caught : new Error("failed to create role")
    }
  }

  async permissionKeysOf(roleId: number): Promise<ReadonlyArray<string> | Error> {
    try {
      const grants = await this.c.var.database
        .select()
        .from(rolePermissions)
        .where(eq(rolePermissions.roleId, roleId))

      const permissionIds = grants.map((row) => row.permissionId)

      if (permissionIds.length === 0) {
        return []
      }

      const rows = await this.c.var.database
        .select()
        .from(permissions)
        .where(inArray(permissions.id, permissionIds))

      return rows.map((row) => row.key)
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to load role permissions")
    }
  }

  async isAssignedToAnyAccount(roleId: number): Promise<boolean | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(accountRoles)
        .where(eq(accountRoles.roleId, roleId))
        .limit(1)

      return rows.length > 0
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to check role assignment")
    }
  }
}
