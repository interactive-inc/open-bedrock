import type { SystemAuthorizationRepository } from "@system/application/iam/system-authorization-repository"
import type { AccountId } from "@system/domain/auth/account-id"
import type { RoleBindingResource } from "@system/domain/iam/role-binding.entity"

export type ResolvedSystemAuthorization = Readonly<{
  permissionKeys: ReadonlySet<string>
  roleKeys: ReadonlyArray<string>
}>

export class ResolveSystemAuthorization {
  constructor(private readonly repository: SystemAuthorizationRepository) {
    Object.freeze(this)
  }

  async execute(command: {
    accountId: AccountId
    resource: RoleBindingResource | null
    at: Date
  }): Promise<ResolvedSystemAuthorization | null | Error> {
    if (!Number.isSafeInteger(command.at.getTime())) {
      return new Error("System authorization time is invalid")
    }

    const graph = await this.repository.loadForAccount(command.accountId)
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
