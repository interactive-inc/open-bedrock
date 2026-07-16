import type { Context } from "@/env"
import { accountRoles, permissions, rolePermissions, roles } from "@/schema"
import type { RoleRow } from "@/schema"
import { isUniqueConstraintError } from "@/infrastructure/shared/is-unique-constraint-error"
import { UniqueConstraintError } from "@/infrastructure/shared/unique-constraint-error"
import { LastAdminError } from "@/infrastructure/iam/last-admin-error"
import {
  abortWhenNoLoginEnabledEffectiveAdmin,
  isAbortedByLastAdminGuard,
} from "@/infrastructure/iam/last-admin-guard"
import {
  abortWhenActorCannotManageRoleById,
  isAbortedByLivePermissionGuard,
  LivePermissionGuardError,
} from "@/infrastructure/iam/live-permission-guard"
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

  /**
   * ロール作成と権限付与を原子的に行う。
   * create で role を挿入し、その ID を使って replacePermissions で権限を一括挿入する。
   * replacePermissions が失敗した場合はロールを削除してクリーンアップする。
   */
  async createWithPermissions(props: {
    key: string
    name: string
    description: string | null
    createdAt: number
    permissionKeys: ReadonlyArray<string>
  }): Promise<RoleRow | "role_key_conflict" | Error> {
    const created = await this.create({
      key: props.key,
      name: props.name,
      description: props.description,
      createdAt: props.createdAt,
    })

    if (created instanceof UniqueConstraintError) {
      return "role_key_conflict"
    }

    if (created instanceof Error) {
      return created
    }

    const replaced = await this.replacePermissions(created.id, props.permissionKeys)

    if (replaced instanceof Error) {
      // 権限付与が失敗したらロールを削除して孤立を防ぐ
      await this.deleteById(created.id)

      return replaced
    }

    return created
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

  async updateMeta(props: {
    roleId: number
    name: string
    description: string | null
  }): Promise<null | Error> {
    try {
      await this.c.var.database
        .update(roles)
        .set({ name: props.name, description: props.description })
        .where(eq(roles.id, props.roleId))

      return null
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to update role")
    }
  }

  /**
   * ロールの permission を一括置換する。
   * permission キーの解決後、既存の DELETE と新規 INSERT を同一の D1 batch にまとめる。
   * 途中失敗時は batch 全体が rollback され、既存権限が保持される。
   */
  async replacePermissions(
    roleId: number,
    permissionKeys: ReadonlyArray<string>,
  ): Promise<null | Error> {
    try {
      const db = this.c.env.DB

      if (permissionKeys.length === 0) {
        await db.batch([db.prepare("DELETE FROM role_permissions WHERE role_id = ?1").bind(roleId)])

        return null
      }

      // permission キーを ID に解決する（読み取り専用なので batch 外で実行）
      const drizzle = this.c.var.database

      const permissionRows = await drizzle
        .select()
        .from(permissions)
        .where(inArray(permissions.key, [...permissionKeys]))

      // DELETE と全 INSERT を同一 batch にまとめてアトミックに実行する
      await db.batch([
        db.prepare("DELETE FROM role_permissions WHERE role_id = ?1").bind(roleId),
        ...permissionRows.map((permission) =>
          db
            .prepare(
              "INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?1, ?2)",
            )
            .bind(roleId, permission.id),
        ),
      ])

      return null
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to replace role permissions")
    }
  }

  /**
   * ロールのメタ情報と権限を単一の D1 batch で原子的に更新する。
   * 途中失敗でメタだけ変わって権限が旧のままになることを防ぐ。
   */
  async updateMetaAndPermissions(props: {
    actorAccountId: number
    roleId: number
    name: string
    description: string | null
    permissionKeys: ReadonlyArray<string>
  }): Promise<null | Error | LastAdminError | LivePermissionGuardError> {
    try {
      const db = this.c.env.DB

      const permissionIds =
        props.permissionKeys.length === 0
          ? []
          : await this.resolvePermissionIds(props.permissionKeys)

      if (permissionIds instanceof Error) {
        return permissionIds
      }

      await db.batch([
        abortWhenActorCannotManageRoleById({
          db,
          actorAccountId: props.actorAccountId,
          targetRoleId: props.roleId,
          requiredPermissionKeys: ["iam:manage_roles"],
          additionalProtectedPermissionKeys: props.permissionKeys,
        }),
        db
          .prepare("UPDATE roles SET name = ?2, description = ?3 WHERE id = ?1")
          .bind(props.roleId, props.name, props.description),
        db.prepare("DELETE FROM role_permissions WHERE role_id = ?1").bind(props.roleId),
        ...permissionIds.map((permissionId) =>
          db
            .prepare(
              "INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?1, ?2)",
            )
            .bind(props.roleId, permissionId),
        ),
        abortWhenNoLoginEnabledEffectiveAdmin(db),
      ])

      return null
    } catch (caught) {
      if (isAbortedByLivePermissionGuard(caught)) {
        return new LivePermissionGuardError({ cause: caught })
      }

      if (isAbortedByLastAdminGuard(caught)) {
        return new LastAdminError()
      }

      return caught instanceof Error ? caught : new Error("failed to update role")
    }
  }

  async deleteById(roleId: number): Promise<null | Error> {
    try {
      await this.c.var.database.delete(roles).where(eq(roles.id, roleId))

      return null
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to delete role")
    }
  }

  /**
   * ロールと紐づく role_permissions を単一の D1 batch で一括削除する。
   * batch 内で account_roles に割当がないことを検証し、割当があれば batch ごと rollback する。
   * TOCTOU を防ぎ、role_permissions の孤立も防ぐ。
   */
  async deleteWithPermissionsGuardingAssignment(
    roleId: number,
  ): Promise<null | "role_in_use" | Error> {
    try {
      const db = this.c.env.DB

      await db.batch([
        db
          .prepare(
            `SELECT CASE WHEN EXISTS (
             SELECT 1 FROM account_roles WHERE role_id = ?1
           ) THEN json_extract('', '$') ELSE 1 END AS ok`,
          )
          .bind(roleId),
        db.prepare("DELETE FROM role_permissions WHERE role_id = ?1").bind(roleId),
        db.prepare("DELETE FROM roles WHERE id = ?1").bind(roleId),
      ])

      return null
    } catch (caught) {
      if (isAbortedByRoleInUseGuard(caught)) {
        return "role_in_use"
      }

      return caught instanceof Error ? caught : new Error("failed to delete role")
    }
  }

  /**
   * permission キーを ID に解決する。batch 外の読み取り専用操作。
   */
  private async resolvePermissionIds(
    permissionKeys: ReadonlyArray<string>,
  ): Promise<ReadonlyArray<number> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(permissions)
        .where(inArray(permissions.key, [...permissionKeys]))

      return rows.map((row) => row.id)
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to resolve permission ids")
    }
  }
}

function isAbortedByRoleInUseGuard(error: unknown): boolean {
  return error instanceof Error && error.message.includes("malformed JSON")
}
