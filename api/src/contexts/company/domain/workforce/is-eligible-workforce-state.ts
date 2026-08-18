import type { WorkforceStateAt } from "@/contexts/company/domain/workforce/resolve-workforce-state"

export function isEligibleWorkforceState(
  state: WorkforceStateAt | undefined,
): state is WorkforceStateAt {
  return (
    state !== undefined &&
    state.employmentId !== null &&
    (state.status === "ACTIVE" || state.status === "ON_LEAVE")
  )
}
