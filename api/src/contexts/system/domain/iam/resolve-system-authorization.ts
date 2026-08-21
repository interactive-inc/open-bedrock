import type { RoleBindingResource } from "@system/domain/iam/role-binding.entity"
import type { SystemAuthorizationGraph } from "@system/domain/iam/system-authorization-graph"

export type ResolvedSystemAuthorization = Readonly<{
  permissionKeys: ReadonlySet<string>
  roleKeys: ReadonlyArray<string>
}>

export function resolveSystemAuthorization(
  graph: SystemAuthorizationGraph,
  command: {
    resource: RoleBindingResource | null
    at: Date
  },
): ResolvedSystemAuthorization | Error {
  if (!Number.isSafeInteger(command.at.getTime())) {
    return new Error("System authorization time is invalid")
  }

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
