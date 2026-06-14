const privilegedRoles: ReadonlyArray<string> = ["manager", "hr", "admin"]

export function canDecideLeave(viewerRole: string): boolean {
  return privilegedRoles.includes(viewerRole)
}
