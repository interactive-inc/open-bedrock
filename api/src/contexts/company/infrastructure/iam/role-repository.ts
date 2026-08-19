import type { Context } from "@/env"
import { LastRootError } from "@/contexts/company/infrastructure/iam/last-root-error"
import { LastRootGuard } from "@/contexts/company/infrastructure/iam/last-root-guard"
import { LivePermissionGuard } from "@/contexts/company/infrastructure/iam/live-permission-guard"
import { LivePermissionGuardError } from "@/contexts/company/infrastructure/iam/live-permission-guard-error"
import { isUniqueConstraintError } from "@/lib/d1/is-unique-constraint-error"
import { permissionKeySchema } from "@/contexts/company/domain/iam/permission-key.catalog"
import type { AccountId } from "@system/domain/auth/account-id"

export type RoleRow = Readonly<{
  id: number
  key: string
  name: string
  description: string | null
  isSystem: number
  createdAt: number
}>

/** 既存APIのnumber/key表現をcanonical System IAMへ写す互換Repository。 */
export class RoleRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async list(): Promise<ReadonlyArray<RoleRow> | Error> {
    try {
      const rows = await this.c.env.DB.prepare(
        `SELECT id, key, kind, name, created_at
         FROM system_iam_roles ORDER BY id`,
      ).all<Record<string, unknown>>()

      const roles = rows.results.map((row) => this.toCompatibilityRole(row))
      const invalid = roles.find((role) => role instanceof Error)
      return invalid instanceof Error ? invalid : (roles as Array<RoleRow>)
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to list roles")
    }
  }

  async findById(id: number): Promise<RoleRow | null | Error> {
    try {
      const row = await this.c.env.DB.prepare(
        `SELECT id, key, kind, name, created_at
           FROM system_iam_roles WHERE id = ?1 LIMIT 1`,
      )
        .bind(String(id))
        .first<Record<string, unknown>>()

      return row === null ? null : this.toCompatibilityRole(row)
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to find role")
    }
  }

  async findByKey(key: string): Promise<RoleRow | null | Error> {
    try {
      const row = await this.c.env.DB.prepare(
        `SELECT id, key, kind, name, created_at
           FROM system_iam_roles WHERE key = ?1 LIMIT 1`,
      )
        .bind(`company:${key}`)
        .first<Record<string, unknown>>()

      return row === null ? null : this.toCompatibilityRole(row)
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to find role")
    }
  }

  async createWithPermissions(props: {
    key: string
    name: string
    description: string | null
    createdAt: number
    permissionKeys: ReadonlyArray<string>
  }): Promise<RoleRow | "role_key_conflict" | Error> {
    try {
      const permissionKeys = [
        ...new Set(
          props.permissionKeys.flatMap((key) => {
            const parsed = permissionKeySchema.safeParse(key)
            return parsed.success ? [parsed.data] : []
          }),
        ),
      ].sort()
      const words = crypto.getRandomValues(new Uint32Array(2))
      const roleId = ((words[0] ?? 0) & 0x000f_ffff) * 0x1_0000_0000 + (words[1] ?? 0) || 1
      const database = this.c.env.DB

      await database.batch([
        database
          .prepare(
            `INSERT INTO system_iam_roles (id, key, kind, name, created_at, updated_at)
             VALUES (?1, ?2, 'custom', ?3, ?4, ?4)`,
          )
          .bind(String(roleId), `company:${props.key}`, props.name, props.createdAt),
        ...permissionKeys.map((permissionKey) =>
          database
            .prepare(
              `INSERT INTO system_iam_role_permissions (role_id, permission_key)
               VALUES (?1, ?2)`,
            )
            .bind(String(roleId), permissionKey),
        ),
        database
          .prepare(
            `SELECT CASE WHEN
               (SELECT count(*) FROM system_iam_role_permissions WHERE role_id = ?1) = ?2
             THEN 1 ELSE json_extract('', '$') END AS ok`,
          )
          .bind(String(roleId), permissionKeys.length),
      ])

      return {
        id: roleId,
        key: props.key,
        name: props.name,
        description: props.description,
        isSystem: 0,
        createdAt: props.createdAt,
      }
    } catch (caught) {
      if (isUniqueConstraintError(caught)) return "role_key_conflict"
      return caught instanceof Error ? caught : new Error("failed to create role")
    }
  }

  async permissionKeysOf(roleId: number): Promise<ReadonlyArray<string> | Error> {
    try {
      const rows = await this.c.env.DB.prepare(
        `SELECT permission_key
           FROM system_iam_role_permissions
           WHERE role_id = ?1 ORDER BY permission_key`,
      )
        .bind(String(roleId))
        .all<{ permission_key: string }>()

      return rows.results.map((row) => row.permission_key)
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to load role permissions")
    }
  }

  async isAssignedToAnyAccount(roleId: number): Promise<boolean | Error> {
    try {
      const assigned = await this.c.env.DB.prepare(
        `SELECT 1 AS assigned FROM system_role_bindings
           WHERE role_id = ?1 AND revoked_at IS NULL LIMIT 1`,
      )
        .bind(String(roleId))
        .first<number>("assigned")
      return assigned === 1
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to check role assignment")
    }
  }

  async replacePermissions(
    roleId: number,
    permissionKeysInput: ReadonlyArray<string>,
  ): Promise<null | Error> {
    try {
      const permissionKeys = [
        ...new Set(
          permissionKeysInput.flatMap((key) => {
            const parsed = permissionKeySchema.safeParse(key)
            return parsed.success ? [parsed.data] : []
          }),
        ),
      ].sort()
      const database = this.c.env.DB
      await database.batch([
        database
          .prepare("DELETE FROM system_iam_role_permissions WHERE role_id = ?1")
          .bind(String(roleId)),
        ...permissionKeys.map((permissionKey) =>
          database
            .prepare(
              `INSERT INTO system_iam_role_permissions (role_id, permission_key)
               SELECT ?1, ?2 WHERE EXISTS (SELECT 1 FROM system_iam_roles WHERE id = ?1)`,
            )
            .bind(String(roleId), permissionKey),
        ),
        database
          .prepare(
            `SELECT CASE WHEN
               EXISTS (SELECT 1 FROM system_iam_roles WHERE id = ?1)
               AND (SELECT count(*) FROM system_iam_role_permissions WHERE role_id = ?1) = ?2
             THEN 1 ELSE json_extract('', '$') END AS ok`,
          )
          .bind(String(roleId), permissionKeys.length),
      ])
      return null
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to replace role permissions")
    }
  }

  async updateMetaAndPermissions(props: {
    actorAccountId: AccountId
    roleId: number
    name: string
    description: string | null
    permissionKeys: ReadonlyArray<string>
  }): Promise<null | Error | LastRootError | LivePermissionGuardError> {
    try {
      const permissionKeys = [
        ...new Set(
          props.permissionKeys.flatMap((key) => {
            const parsed = permissionKeySchema.safeParse(key)
            return parsed.success ? [parsed.data] : []
          }),
        ),
      ].sort()
      const database = this.c.env.DB
      const now = new Date(this.c.env.NOW ?? Date.now()).getTime()
      await database.batch([
        new LivePermissionGuard(this.c).abortWhenActorCannotManageRoleById({
          actorAccountId: props.actorAccountId,
          targetRoleId: props.roleId,
          requiredPermissionKeys: ["iam:manage_roles"],
          additionalProtectedPermissionKeys: permissionKeys,
        }),
        database
          .prepare(
            `UPDATE system_iam_roles SET name = ?2, updated_at = max(updated_at, ?3)
             WHERE id = ?1 AND kind = 'custom'`,
          )
          .bind(String(props.roleId), props.name, now),
        database
          .prepare("DELETE FROM system_iam_role_permissions WHERE role_id = ?1")
          .bind(String(props.roleId)),
        ...permissionKeys.map((permissionKey) =>
          database
            .prepare(
              `INSERT INTO system_iam_role_permissions (role_id, permission_key)
               VALUES (?1, ?2)`,
            )
            .bind(String(props.roleId), permissionKey),
        ),
        new LastRootGuard(this.c).abortWhenNoLoginEnabledEffectiveRoot(),
      ])
      return null
    } catch (caught) {
      if (LivePermissionGuard.isAbortedBy(caught)) {
        return new LivePermissionGuardError({ cause: caught })
      }
      if (LastRootGuard.isAbortedBy(caught)) return new LastRootError()
      return caught instanceof Error ? caught : new Error("failed to update role")
    }
  }

  async deleteWithPermissionsGuardingAssignment(
    roleId: number,
  ): Promise<null | "role_in_use" | Error> {
    try {
      const database = this.c.env.DB
      await database.batch([
        database
          .prepare(
            `SELECT CASE WHEN EXISTS (
               SELECT 1 FROM system_role_bindings WHERE role_id = ?1 AND revoked_at IS NULL
             ) THEN json_extract('', '$') ELSE 1 END AS ok`,
          )
          .bind(String(roleId)),
        database
          .prepare("DELETE FROM system_iam_role_permissions WHERE role_id = ?1")
          .bind(String(roleId)),
        database
          .prepare("DELETE FROM system_iam_roles WHERE id = ?1 AND kind = 'custom'")
          .bind(String(roleId)),
      ])
      return null
    } catch (caught) {
      if (caught instanceof Error && caught.message.includes("malformed JSON")) {
        return "role_in_use"
      }
      return caught instanceof Error ? caught : new Error("failed to delete role")
    }
  }

  private toCompatibilityRole(row: Record<string, unknown>): RoleRow | Error {
    const id = Number(row.id)
    if (
      !Number.isSafeInteger(id) ||
      id < 1 ||
      String(id) !== row.id ||
      typeof row.key !== "string" ||
      !row.key.startsWith("company:") ||
      (row.kind !== "managed" && row.kind !== "custom") ||
      typeof row.name !== "string" ||
      typeof row.created_at !== "number"
    ) {
      return new Error("canonical System IAM role is not legacy-compatible")
    }

    return {
      id,
      key: row.key.slice("company:".length),
      name: row.name,
      description: null,
      isSystem: row.kind === "managed" ? 1 : 0,
      createdAt: row.created_at,
    }
  }
}
