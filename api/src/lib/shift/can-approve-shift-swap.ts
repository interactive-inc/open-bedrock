const privilegedRoles: ReadonlyArray<string> = ["manager", "hr", "admin"]

/** シフト交代の承認ができる役割か。 */
export function canApproveShiftSwap(viewerRole: string): boolean {
  return privilegedRoles.includes(viewerRole)
}
