import type { WorkforceStateAt } from "@/contexts/company/domain/workforce/resolve-workforce-state"

export function isOrganizationalAuthorityStateEligible(state: WorkforceStateAt): boolean {
  return state.employmentId !== null && (state.status === "ACTIVE" || state.status === "ON_LEAVE")
}
