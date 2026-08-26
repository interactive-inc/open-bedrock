import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { IamRoleEntity } from "@system/domain/entities/iam-role.entity"
import { RoleBindingEntity } from "@system/domain/entities/role-binding.entity"
import type { RoleBindingResource } from "@system/domain/schemas/iam/role-binding.schema"
import type { SystemD1Context } from "@system/configuration/system-context"

export type SystemAuthorizationGraph = Readonly<{
  roles: ReadonlyArray<IamRoleEntity>
  bindings: ReadonlyArray<RoleBindingEntity>
}>

export type ResolvedSystemAuthorization = Readonly<{
  permissionKeys: ReadonlySet<string>
  roleKeys: ReadonlyArray<string>
}>
type Context = SystemD1Context

export class SystemD1AuthorizationAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async loadForAccount(accountId: AccountId): Promise<SystemAuthorizationGraph | null | Error> {
    try {
      const database = this.c.env.DB
      const account = await database
        .prepare("SELECT status FROM system_accounts WHERE id = ?1 LIMIT 1")
        .bind(accountId)
        .first<{ status: unknown }>()
      if (account === null || account.status !== "active") return null

      const rows = await database
        .prepare(
          `SELECT
             role.id AS role_id,
             role.key AS role_key,
             role.kind AS role_kind,
             role.resource_type AS role_resource_type,
             role.name AS role_name,
             role.created_at AS role_created_at,
             role.updated_at AS role_updated_at,
             binding.id AS binding_id,
             binding.account_id,
             binding.resource_type,
             binding.resource_id,
             binding.created_at AS binding_created_at,
             binding.revoked_at,
             permission.permission_key
           FROM system_role_bindings AS binding
           INNER JOIN system_iam_roles AS role ON role.id = binding.role_id
           LEFT JOIN system_iam_role_permissions AS permission ON permission.role_id = role.id
           WHERE binding.account_id = ?1
           ORDER BY role.id, permission.permission_key`,
        )
        .bind(accountId)
        .all<Record<string, unknown>>()

      const roleRows = new Map<string, { row: Record<string, unknown>; permissions: Set<string> }>()
      const bindingRows = new Map<string, Record<string, unknown>>()
      for (const row of rows.results) {
        if (typeof row.role_id !== "string" || typeof row.binding_id !== "string") {
          return new Error("System IAM authorization row is invalid")
        }
        const entry = roleRows.get(row.role_id) ?? { row, permissions: new Set<string>() }
        if (typeof row.permission_key === "string") entry.permissions.add(row.permission_key)
        roleRows.set(row.role_id, entry)
        bindingRows.set(row.binding_id, row)
      }

      const roles = [...roleRows.values()].map(({ row, permissions }) =>
        IamRoleEntity.create({
          id: row.role_id,
          key: row.role_key,
          kind: row.role_kind,
          resourceType: row.role_resource_type,
          name: row.role_name,
          permissionKeys: [...permissions].sort(),
          createdAt:
            typeof row.role_created_at === "number"
              ? new Date(row.role_created_at)
              : row.role_created_at,
          updatedAt:
            typeof row.role_updated_at === "number"
              ? new Date(row.role_updated_at)
              : row.role_updated_at,
        }),
      )
      const bindings = [...bindingRows.values()].map((row) =>
        RoleBindingEntity.create({
          id: row.binding_id,
          accountId: row.account_id,
          roleId: row.role_id,
          resource:
            row.resource_type === null && row.resource_id === null
              ? null
              : { type: row.resource_type, id: row.resource_id },
          createdAt:
            typeof row.binding_created_at === "number"
              ? new Date(row.binding_created_at)
              : row.binding_created_at,
          revokedAt:
            row.revoked_at === null
              ? null
              : typeof row.revoked_at === "number"
                ? new Date(row.revoked_at)
                : row.revoked_at,
        }),
      )
      const invalid = [...roles, ...bindings].find((value) => value instanceof Error)
      if (invalid instanceof Error) return invalid

      return Object.freeze({
        roles: Object.freeze(roles as Array<IamRoleEntity>),
        bindings: Object.freeze(bindings as Array<RoleBindingEntity>),
      })
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to resolve System authorization")
    }
  }

  async resolveForAccount(command: {
    accountId: AccountId
    resource: RoleBindingResource | null
    at: Date
  }): Promise<ResolvedSystemAuthorization | null | Error> {
    if (!Number.isSafeInteger(command.at.getTime())) {
      return new Error("System authorization time is invalid")
    }

    const graph = await this.loadForAccount(command.accountId)
    if (graph === null || graph instanceof Error) return graph

    const rolesById = new Map(graph.roles.map((role) => [role.id, role]))
    const activeRoles = new Map(
      graph.bindings.flatMap((binding) => {
        if (!binding.isActiveAt(command.at) || !binding.appliesTo(command.resource)) return []
        const role = rolesById.get(binding.roleId)
        return role === undefined ? [] : [[role.id, role] as const]
      }),
    ).values()
    const roles = [...activeRoles]

    return Object.freeze({
      permissionKeys: new Set(roles.flatMap((role) => role.permissionKeys)),
      roleKeys: Object.freeze(roles.map((role) => role.key).sort()),
    })
  }
}
