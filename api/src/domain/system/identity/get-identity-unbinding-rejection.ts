import { IdentityBinding } from "@system/domain/identity/identity-binding.entity"
import { zIdentityId } from "@system/domain/identity/identity-id"

export const identityUnbindingRejections = Object.freeze([
  "identity_not_active",
  "invalid_identity_binding_collection",
  "last_active_identity_binding",
] as const)

export type IdentityUnbindingRejection = (typeof identityUnbindingRejections)[number]

/**
 * 読み取ったbinding集合でunbinding可否を判定する。
 * Infrastructureは競合を防ぐため、同じlast-active条件をwriteと同じatomic境界で再検査する。
 */
export function getIdentityUnbindingRejection(
  targetIdentityId: unknown,
  bindings: unknown,
): IdentityUnbindingRejection | null {
  const parsedTargetIdentityId = zIdentityId.safeParse(targetIdentityId)

  if (!parsedTargetIdentityId.success) return "identity_not_active"
  if (
    !Array.isArray(bindings) ||
    bindings.some((binding) => !(binding instanceof IdentityBinding))
  ) {
    return "invalid_identity_binding_collection"
  }

  const identityIds = new Set<string>()
  const providerSubjects = new Set<string>()
  const accountIds = new Set<string>()

  for (const binding of bindings) {
    const providerSubject = `${binding.provider}\u0000${binding.subject}`

    if (identityIds.has(binding.id) || providerSubjects.has(providerSubject)) {
      return "invalid_identity_binding_collection"
    }

    identityIds.add(binding.id)
    providerSubjects.add(providerSubject)
    accountIds.add(binding.accountId)
  }

  if (accountIds.size > 1) return "invalid_identity_binding_collection"

  const activeBindings = bindings.filter((binding) => binding.state === "active")
  const target = activeBindings.find((binding) => binding.id === parsedTargetIdentityId.data)

  if (target === undefined) return "identity_not_active"
  return activeBindings.length === 1 ? "last_active_identity_binding" : null
}
